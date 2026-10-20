-- OceanBlue MVP schema. Apply with `supabase db push` or the Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.movement_type as enum ('in', 'out');

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.warehouse_members (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'manager' check (role in ('manager', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (warehouse_id, user_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  sku text not null check (char_length(trim(sku)) between 1 and 80),
  category text not null default 'Uncategorized' check (char_length(trim(category)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, sku)
);

create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  batch_number text not null check (char_length(trim(batch_number)) between 1 and 80),
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  expiry_date date,
  created_at timestamptz not null default now(),
  unique (product_id, batch_number)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  batch_id uuid references public.product_batches(id) on delete restrict,
  movement_type public.movement_type not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  reason text check (char_length(reason) <= 240),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index products_warehouse_id_idx on public.products(warehouse_id);
create index product_batches_product_id_idx on public.product_batches(product_id);
create index product_batches_expiry_idx on public.product_batches(expiry_date) where quantity > 0;
create index stock_movements_product_created_idx on public.stock_movements(product_id, created_at desc);
create index stock_movements_warehouse_created_idx on public.stock_movements(warehouse_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

-- Each authenticated manager receives one starter warehouse. This is deliberately a single
-- warehouse per user for the MVP; it does not introduce multi-warehouse UI complexity.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_warehouse_id uuid;
begin
  insert into public.warehouses(name) values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'warehouse_name'), ''), 'My warehouse')) returning id into new_warehouse_id;
  insert into public.warehouse_members(warehouse_id, user_id, role) values (new_warehouse_id, new.id, 'manager');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER avoids RLS policy recursion; it only returns a boolean for auth.uid().
create or replace function public.is_warehouse_member(target_warehouse_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.warehouse_members where warehouse_id = target_warehouse_id and user_id = auth.uid());
$$;

alter table public.warehouses enable row level security;
alter table public.warehouse_members enable row level security;
alter table public.products enable row level security;
alter table public.product_batches enable row level security;
alter table public.stock_movements enable row level security;

create policy "members read warehouses" on public.warehouses for select to authenticated using (public.is_warehouse_member(id));
create policy "members read own membership" on public.warehouse_members for select to authenticated using (user_id = auth.uid());
create policy "members read products" on public.products for select to authenticated using (public.is_warehouse_member(warehouse_id));
create policy "managers manage products" on public.products for all to authenticated using (exists (select 1 from public.warehouse_members where warehouse_id = products.warehouse_id and user_id = auth.uid() and role = 'manager')) with check (exists (select 1 from public.warehouse_members where warehouse_id = products.warehouse_id and user_id = auth.uid() and role = 'manager'));
create policy "members read batches" on public.product_batches for select to authenticated using (exists (select 1 from public.products where products.id = product_batches.product_id and public.is_warehouse_member(products.warehouse_id)));
create policy "members read movements" on public.stock_movements for select to authenticated using (public.is_warehouse_member(warehouse_id));

-- All stock changes go through this RPC. It locks the selected batch, prevents overdrawing,
-- inserts the immutable audit event, and updates batch quantity in one database transaction.
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
  if not exists (select 1 from public.warehouse_members where warehouse_id = p_warehouse_id and user_id = auth.uid() and role = 'manager') then raise exception 'You do not have permission to record movements for this warehouse'; end if;
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

-- Optional, manager-triggered Buildathon dataset. It seeds only the caller's first
-- warehouse and refuses to overwrite a real catalog.
create or replace function public.seed_breadtalk_demo()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target_warehouse_id uuid;
  croissant_id uuid; sourdough_id uuid; wheat_id uuid; danish_id uuid; milk_id uuid; yogurt_id uuid;
  croissant_batch uuid; sourdough_batch uuid; wheat_batch uuid; danish_batch uuid; milk_batch uuid; yogurt_batch uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select warehouse_id into target_warehouse_id from public.warehouse_members where user_id = auth.uid() and role = 'manager' order by created_at limit 1;
  if target_warehouse_id is null then raise exception 'No manager warehouse is available'; end if;
  if exists (select 1 from public.products where warehouse_id = target_warehouse_id) then raise exception 'Demo data can only be loaded into an empty warehouse'; end if;

  insert into public.products(warehouse_id, name, sku, category) values
    (target_warehouse_id, 'Butter croissant', 'BT-CR-101', 'Fresh bread'),
    (target_warehouse_id, 'Sourdough loaf', 'BT-SD-204', 'Fresh bread'),
    (target_warehouse_id, 'Whole wheat sandwich bread', 'BT-WW-310', 'Fresh bread'),
    (target_warehouse_id, 'Cheese danish', 'BT-CD-115', 'Pastries'),
    (target_warehouse_id, 'Fresh milk · 1 L', 'BT-FM-401', 'Dairy'),
    (target_warehouse_id, 'Greek yogurt · 150 g', 'BT-GY-402', 'Dairy');
  select id into sourdough_id from public.products where warehouse_id = target_warehouse_id and sku = 'BT-SD-204';
  select id into wheat_id from public.products where warehouse_id = target_warehouse_id and sku = 'BT-WW-310';
  select id into danish_id from public.products where warehouse_id = target_warehouse_id and sku = 'BT-CD-115';
  select id into milk_id from public.products where warehouse_id = target_warehouse_id and sku = 'BT-FM-401';
  select id into yogurt_id from public.products where warehouse_id = target_warehouse_id and sku = 'BT-GY-402';

  select id into croissant_id from public.products where warehouse_id = target_warehouse_id and sku = 'BT-CR-101';
  insert into public.product_batches(product_id, batch_number, quantity, expiry_date) values
    (croissant_id, 'CR-201026', 10, current_date + 3),
    (sourdough_id, 'SD-201026', 48, current_date + 4),
    (wheat_id, 'WW-201026', 120, current_date + 5),
    (danish_id, 'CD-201026', 30, current_date + 2),
    (milk_id, 'FM-191026', 18, current_date + 3),
    (yogurt_id, 'GY-181026', 40, current_date + 2);
  select id into croissant_batch from public.product_batches where product_id = croissant_id;
  select id into sourdough_batch from public.product_batches where product_id = sourdough_id;
  select id into wheat_batch from public.product_batches where product_id = wheat_id;
  select id into danish_batch from public.product_batches where product_id = danish_id;
  select id into milk_batch from public.product_batches where product_id = milk_id;
  select id into yogurt_batch from public.product_batches where product_id = yogurt_id;

  insert into public.stock_movements(warehouse_id, product_id, batch_id, movement_type, quantity, reason, created_by, created_at) values
    (target_warehouse_id, croissant_id, croissant_batch, 'out', 42, 'Morning retail dispatch', auth.uid(), now() - interval '20 days'),
    (target_warehouse_id, croissant_id, croissant_batch, 'out', 38, 'Morning retail dispatch', auth.uid(), now() - interval '13 days'),
    (target_warehouse_id, croissant_id, croissant_batch, 'out', 40, 'Morning retail dispatch', auth.uid(), now() - interval '5 days'),
    (target_warehouse_id, sourdough_id, sourdough_batch, 'out', 80, 'Bakery counter replenishment', auth.uid(), now() - interval '21 days'),
    (target_warehouse_id, sourdough_id, sourdough_batch, 'out', 75, 'Bakery counter replenishment', auth.uid(), now() - interval '12 days'),
    (target_warehouse_id, sourdough_id, sourdough_batch, 'out', 85, 'Bakery counter replenishment', auth.uid(), now() - interval '4 days'),
    (target_warehouse_id, wheat_id, wheat_batch, 'out', 70, 'Retail dispatch', auth.uid(), now() - interval '21 days'),
    (target_warehouse_id, wheat_id, wheat_batch, 'out', 80, 'Retail dispatch', auth.uid(), now() - interval '12 days'),
    (target_warehouse_id, wheat_id, wheat_batch, 'out', 90, 'Retail dispatch', auth.uid(), now() - interval '4 days'),
    (target_warehouse_id, danish_id, danish_batch, 'out', 30, 'Pastry counter dispatch', auth.uid(), now() - interval '16 days'),
    (target_warehouse_id, danish_id, danish_batch, 'out', 28, 'Pastry counter dispatch', auth.uid(), now() - interval '8 days'),
    (target_warehouse_id, danish_id, danish_batch, 'out', 32, 'Pastry counter dispatch', auth.uid(), now() - interval '2 days'),
    (target_warehouse_id, milk_id, milk_batch, 'out', 28, 'Cafe replenishment', auth.uid(), now() - interval '18 days'),
    (target_warehouse_id, milk_id, milk_batch, 'out', 30, 'Cafe replenishment', auth.uid(), now() - interval '9 days'),
    (target_warehouse_id, milk_id, milk_batch, 'out', 32, 'Cafe replenishment', auth.uid(), now() - interval '3 days'),
    (target_warehouse_id, yogurt_id, yogurt_batch, 'out', 55, 'Cafe replenishment', auth.uid(), now() - interval '18 days'),
    (target_warehouse_id, yogurt_id, yogurt_batch, 'out', 60, 'Cafe replenishment', auth.uid(), now() - interval '9 days'),
    (target_warehouse_id, yogurt_id, yogurt_batch, 'out', 65, 'Cafe replenishment', auth.uid(), now() - interval '3 days');
  return jsonb_build_object('seeded', true, 'brand', 'BreadTalk', 'product_count', 6);
end;
$$;
revoke all on function public.seed_breadtalk_demo() from public;
grant execute on function public.seed_breadtalk_demo() to authenticated;
