-- Per-user identity, three workspace roles, and admin-only account provisioning.
alter table public.profiles add column if not exists username text;

insert into public.profiles(id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;

with names as (
  select p.id,
    left(lower(regexp_replace(split_part(coalesce(nullif(u.email, ''), p.id::text), '@', 1), '[^a-zA-Z0-9_]+', '_', 'g')), 24) as base,
    row_number() over (partition by left(lower(regexp_replace(split_part(coalesce(nullif(u.email, ''), p.id::text), '@', 1), '[^a-zA-Z0-9_]+', '_', 'g')), 24) order by p.id) as duplicate_number
  from public.profiles p join auth.users u on u.id = p.id
  where p.username is null
)
update public.profiles p
set username = case
  when length(names.base) < 3 then 'user_' || left(replace(names.id::text, '-', ''), 12)
  when names.duplicate_number = 1 then names.base
  else left(names.base, 24) || '_' || names.duplicate_number::text
end
from names where names.id = p.id;

alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format check (username = lower(username) and username ~ '^[a-z0-9_]{3,32}$');
create unique index profiles_username_unique on public.profiles(username);
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Migrate existing warehouse-level access and retain system admins separately.
alter table public.warehouse_members drop constraint if exists warehouse_members_role_check;
update public.warehouse_members set role = 'editor' where role = 'manager';
alter table public.warehouse_members add constraint warehouse_members_role_check check (role in ('editor', 'viewer'));

drop policy if exists "managers manage products" on public.products;
create policy "editors manage products" on public.products for all to authenticated
using (public.is_system_admin() or exists (select 1 from public.warehouse_members where warehouse_id = products.warehouse_id and user_id = auth.uid() and role = 'editor'))
with check (public.is_system_admin() or exists (select 1 from public.warehouse_members where warehouse_id = products.warehouse_id and user_id = auth.uid() and role = 'editor'));
drop policy if exists "members read warehouses" on public.warehouses;
create policy "members read warehouses" on public.warehouses for select to authenticated using (public.is_system_admin() or public.is_warehouse_member(id));
drop policy if exists "members read products" on public.products;
create policy "members read products" on public.products for select to authenticated using (public.is_system_admin() or public.is_warehouse_member(warehouse_id));
drop policy if exists "members read batches" on public.product_batches;
create policy "members read batches" on public.product_batches for select to authenticated using (public.is_system_admin() or exists (select 1 from public.products where products.id = product_batches.product_id and public.is_warehouse_member(products.warehouse_id)));
drop policy if exists "members read movements" on public.stock_movements;
create policy "members read movements" on public.stock_movements for select to authenticated using (public.is_system_admin() or public.is_warehouse_member(warehouse_id));

-- Keep the existing BreadTalk loader working after manager is renamed to editor.
create or replace function public.seed_breadtalk_demo()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  primary_warehouse uuid;
  junction_warehouse uuid;
  airport_warehouse uuid;
  target_warehouse uuid;
  product_row record;
  product_id uuid;
  batch_id uuid;
  items jsonb := '[
    {"name":"Butter croissant","sku":"BT-CR-101","category":"Fresh bread","qty":18,"expiry":2,"demand":44},
    {"name":"Sourdough loaf","sku":"BT-SD-204","category":"Fresh bread","qty":48,"expiry":5,"demand":30},
    {"name":"Whole wheat sandwich bread","sku":"BT-WW-310","category":"Fresh bread","qty":120,"expiry":6,"demand":9},
    {"name":"Cheese danish","sku":"BT-CD-115","category":"Pastries","qty":22,"expiry":2,"demand":18},
    {"name":"Fresh milk · 1 L","sku":"BT-FM-401","category":"Dairy","qty":16,"expiry":3,"demand":12},
    {"name":"Greek yogurt · 150 g","sku":"BT-GY-402","category":"Dairy","qty":40,"expiry":4,"demand":7},
    {"name":"Chocolate bun","sku":"BT-CB-122","category":"Fresh bread","qty":64,"expiry":3,"demand":14},
    {"name":"Vanilla custard bun","sku":"BT-VC-132","category":"Pastries","qty":36,"expiry":2,"demand":11}
  ]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select warehouse_id into primary_warehouse from public.warehouse_members
    where user_id = auth.uid() and role = 'editor' order by created_at limit 1;
  if primary_warehouse is null then raise exception 'Editor access is required to load demo data'; end if;
  update public.warehouses set name = 'BreadTalk Central Kitchen'
    where id = primary_warehouse and name in ('My warehouse', 'Main warehouse');
  select id into junction_warehouse from public.warehouses where name = 'BreadTalk Junction 8'
    and exists (select 1 from public.warehouse_members where warehouse_id = warehouses.id and user_id = auth.uid());
  if junction_warehouse is null then
    insert into public.warehouses(name) values ('BreadTalk Junction 8') returning id into junction_warehouse;
    insert into public.warehouse_members(warehouse_id,user_id,role) values (junction_warehouse,auth.uid(),'editor');
  end if;
  select id into airport_warehouse from public.warehouses where name = 'BreadTalk Airport Hub'
    and exists (select 1 from public.warehouse_members where warehouse_id = warehouses.id and user_id = auth.uid());
  if airport_warehouse is null then
    insert into public.warehouses(name) values ('BreadTalk Airport Hub') returning id into airport_warehouse;
    insert into public.warehouse_members(warehouse_id,user_id,role) values (airport_warehouse,auth.uid(),'editor');
  end if;
  foreach target_warehouse in array array[primary_warehouse,junction_warehouse,airport_warehouse] loop
    if not exists (select 1 from public.products where warehouse_id = target_warehouse) then
      for product_row in select * from jsonb_to_recordset(items) as x(name text, sku text, category text, qty numeric, expiry integer, demand numeric) loop
        insert into public.products(warehouse_id,name,sku,category) values (target_warehouse,product_row.name,product_row.sku,product_row.category) returning id into product_id;
        insert into public.product_batches(product_id,batch_number,quantity,expiry_date)
          values (product_id, replace(product_row.sku,'BT-','') || '-' || to_char(current_date,'YYMMDD'), product_row.qty, current_date + product_row.expiry) returning id into batch_id;
        insert into public.stock_movements(warehouse_id,product_id,batch_id,movement_type,quantity,reason,created_by,created_at) values
          (target_warehouse,product_id,batch_id,'out',product_row.demand,'Retail replenishment',auth.uid(),now()-interval '20 days'),
          (target_warehouse,product_id,batch_id,'out',product_row.demand*0.9,'Retail replenishment',auth.uid(),now()-interval '11 days'),
          (target_warehouse,product_id,batch_id,'out',product_row.demand*1.1,'Retail replenishment',auth.uid(),now()-interval '3 days');
      end loop;
    end if;
  end loop;
  return jsonb_build_object('seeded',true,'brand','BreadTalk','warehouses',3,'products_per_warehouse',8);
end;
$$;
revoke all on function public.seed_breadtalk_demo() from public;
grant execute on function public.seed_breadtalk_demo() to authenticated;

-- A service-role-only provisioning record is required for every new auth user.
-- The auth trigger rejects public sign-ups even if Supabase's public signup switch
-- is accidentally left enabled.
create table public.user_provisioning_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  email text not null check (email = lower(trim(email))),
  username text not null check (username = lower(username) and username ~ '^[a-z0-9_]{3,32}$'),
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  app_role text not null check (app_role in ('system_admin', 'editor', 'viewer')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  consumed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now()
);
alter table public.user_provisioning_tokens enable row level security;
revoke all on public.user_provisioning_tokens from anon, authenticated;
grant all on public.user_provisioning_tokens to service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  provision public.user_provisioning_tokens;
  assigned_role text;
begin
  if new.raw_user_meta_data ->> 'oceanblue_provisioning_token' is null then
    raise exception 'OceanBlue accounts must be created by a system administrator';
  end if;
  select * into provision from public.user_provisioning_tokens
    where token = (new.raw_user_meta_data ->> 'oceanblue_provisioning_token')::uuid
      and email = lower(new.email) and consumed_at is null and expires_at > now()
    for update;
  if not found then raise exception 'This administrator invitation is invalid or expired'; end if;

  assigned_role := case when provision.app_role = 'viewer' then 'viewer' else 'editor' end;
  insert into public.profiles(id, full_name, username)
    values (new.id, provision.full_name, provision.username);
  insert into public.warehouse_members(warehouse_id, user_id, role)
    values (provision.warehouse_id, new.id, assigned_role);
  if provision.app_role = 'system_admin' then
    insert into public.system_admins(user_id) values (new.id);
  end if;
  update public.user_provisioning_tokens set consumed_at = now() where id = provision.id;
  return new;
end;
$$;

create or replace function public.record_stock_movement(
  p_warehouse_id uuid,
  p_product_id uuid,
  p_movement_type public.movement_type,
  p_quantity numeric,
  p_batch_id uuid default null,
  p_batch_number text default null,
  p_expiry_date date default null,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target_batch public.product_batches;
  movement_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if not (public.is_system_admin() or exists (select 1 from public.warehouse_members where warehouse_id = p_warehouse_id and user_id = auth.uid() and role = 'editor')) then raise exception 'You do not have permission to record movements for this warehouse'; end if;
  if not exists (select 1 from public.products where id = p_product_id and warehouse_id = p_warehouse_id) then raise exception 'Product does not belong to this warehouse'; end if;
  if p_movement_type = 'in' and p_batch_id is null then
    if nullif(trim(coalesce(p_batch_number, '')), '') is null then raise exception 'A batch number is required for Stock In'; end if;
    if p_expiry_date is null then raise exception 'An expiry date is required for inbound food stock'; end if;
    insert into public.product_batches(product_id, batch_number, quantity, expiry_date)
      values (p_product_id, trim(p_batch_number), p_quantity, p_expiry_date)
      on conflict (product_id, batch_number) do update set quantity = public.product_batches.quantity + excluded.quantity, expiry_date = excluded.expiry_date
      returning * into target_batch;
  else
    if p_batch_id is null then raise exception 'A batch is required for Stock Out'; end if;
    select * into target_batch from public.product_batches where id = p_batch_id and product_id = p_product_id for update;
    if not found then raise exception 'The selected batch was not found'; end if;
    if p_movement_type = 'out' and target_batch.quantity < p_quantity then raise exception 'Stock Out cannot exceed the available batch quantity'; end if;
    update public.product_batches set quantity = case when p_movement_type = 'in' then quantity + p_quantity else quantity - p_quantity end where id = target_batch.id returning * into target_batch;
  end if;
  insert into public.stock_movements(warehouse_id, product_id, batch_id, movement_type, quantity, reason, created_by)
    values (p_warehouse_id, p_product_id, target_batch.id, p_movement_type, p_quantity, nullif(trim(coalesce(p_reason, '')), ''), auth.uid()) returning id into movement_id;
  return jsonb_build_object('movement_id', movement_id, 'batch_id', target_batch.id, 'available_in_batch', target_batch.quantity);
end;
$$;
revoke all on function public.record_stock_movement(uuid, uuid, public.movement_type, numeric, uuid, text, date, text) from public;
grant execute on function public.record_stock_movement(uuid, uuid, public.movement_type, numeric, uuid, text, date, text) to authenticated;
