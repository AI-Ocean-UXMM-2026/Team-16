-- Admin-managed product categories and safely archived branches.
alter table public.warehouses add column if not exists archived_at timestamptz;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_categories_name_unique on public.product_categories(lower(name));
create trigger product_categories_set_updated_at before update on public.product_categories for each row execute function public.set_updated_at();
alter table public.product_categories enable row level security;
create policy "authenticated users read product categories" on public.product_categories for select to authenticated using (true);
create policy "system admins manage product categories" on public.product_categories for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

insert into public.product_categories(name)
select distinct trim(category) from public.products where nullif(trim(category), '') is not null
on conflict do nothing;
insert into public.product_categories(name) values ('Fresh bread'), ('Pastries'), ('Dairy'), ('Frozen'), ('Beverages'), ('Other')
on conflict do nothing;

create or replace function public.rename_product_category(old_name text, new_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_system_admin() then raise exception 'Only a System Admin can manage product categories'; end if;
  if char_length(trim(coalesce(new_name, ''))) not between 1 and 80 then raise exception 'Category names must be 1 to 80 characters'; end if;
  if not exists (select 1 from public.product_categories where lower(name) = lower(trim(old_name))) then raise exception 'Category not found'; end if;
  if exists (select 1 from public.product_categories where lower(name) = lower(trim(new_name)) and lower(name) <> lower(trim(old_name))) then raise exception 'A category with that name already exists'; end if;
  update public.products set category = trim(new_name) where lower(category) = lower(trim(old_name));
  update public.product_categories set name = trim(new_name) where lower(name) = lower(trim(old_name));
end;
$$;
revoke all on function public.rename_product_category(text, text) from public;
grant execute on function public.rename_product_category(text, text) to authenticated;

create or replace function public.delete_product_category(target_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_system_admin() then raise exception 'Only a System Admin can manage product categories'; end if;
  if exists (select 1 from public.products where lower(category) = lower(trim(target_name))) then
    raise exception 'This category is still assigned to products. Reassign those products before removing it';
  end if;
  delete from public.product_categories where lower(name) = lower(trim(target_name));
  if not found then raise exception 'Category not found'; end if;
end;
$$;
revoke all on function public.delete_product_category(text) from public;
grant execute on function public.delete_product_category(text) to authenticated;

-- Do not let archived branches reappear in warehouse selectors or member reads.
drop policy if exists "members read warehouses" on public.warehouses;
create policy "members read warehouses" on public.warehouses for select to authenticated
  using (archived_at is null and (public.is_system_admin() or public.is_warehouse_member(id)));

-- Keep the demo loader compatible with role names and hide archived branches.
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
  select wm.warehouse_id into primary_warehouse from public.warehouse_members wm
    join public.warehouses w on w.id = wm.warehouse_id
    where wm.user_id = auth.uid() and wm.role = 'editor' and w.archived_at is null order by wm.created_at limit 1;
  if primary_warehouse is null then raise exception 'Editor access is required to load demo data'; end if;
  update public.warehouses set name = 'BreadTalk Central Kitchen' where id = primary_warehouse and name in ('My warehouse', 'Main warehouse');
  select id into junction_warehouse from public.warehouses where name = 'BreadTalk Junction 8' and archived_at is null
    and exists (select 1 from public.warehouse_members where warehouse_id = warehouses.id and user_id = auth.uid());
  if junction_warehouse is null then
    insert into public.warehouses(name) values ('BreadTalk Junction 8') returning id into junction_warehouse;
    insert into public.warehouse_members(warehouse_id,user_id,role) values (junction_warehouse,auth.uid(),'editor');
  end if;
  select id into airport_warehouse from public.warehouses where name = 'BreadTalk Airport Hub' and archived_at is null
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
  insert into public.product_categories(name)
    select distinct trim(category) from public.products where warehouse_id = any(array[primary_warehouse,junction_warehouse,airport_warehouse])
    on conflict do nothing;
  return jsonb_build_object('seeded',true,'brand','BreadTalk','warehouses',3,'products_per_warehouse',8);
end;
$$;
revoke all on function public.seed_breadtalk_demo() from public;
grant execute on function public.seed_breadtalk_demo() to authenticated;
