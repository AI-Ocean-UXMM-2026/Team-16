-- Adds a realistic, isolated BreadTalk demo network for the signed-in manager.
-- It never overwrites an existing catalog; rerunning it is safe.
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
  select warehouse_id into primary_warehouse from public.warehouse_members where user_id = auth.uid() and role = 'manager' order by created_at limit 1;
  if primary_warehouse is null then raise exception 'No manager warehouse is available'; end if;
  update public.warehouses set name = 'BreadTalk Central Kitchen' where id = primary_warehouse and name in ('My warehouse', 'Main warehouse');
  select id into junction_warehouse from public.warehouses where name = 'BreadTalk Junction 8' and exists (select 1 from public.warehouse_members where warehouse_id = warehouses.id and user_id = auth.uid());
  if junction_warehouse is null then insert into public.warehouses(name) values ('BreadTalk Junction 8') returning id into junction_warehouse; insert into public.warehouse_members(warehouse_id,user_id,role) values (junction_warehouse,auth.uid(),'manager'); end if;
  select id into airport_warehouse from public.warehouses where name = 'BreadTalk Airport Hub' and exists (select 1 from public.warehouse_members where warehouse_id = warehouses.id and user_id = auth.uid());
  if airport_warehouse is null then insert into public.warehouses(name) values ('BreadTalk Airport Hub') returning id into airport_warehouse; insert into public.warehouse_members(warehouse_id,user_id,role) values (airport_warehouse,auth.uid(),'manager'); end if;
  foreach target_warehouse in array array[primary_warehouse,junction_warehouse,airport_warehouse] loop
    if not exists (select 1 from public.products where warehouse_id = target_warehouse) then
      for product_row in select * from jsonb_to_recordset(items) as x(name text, sku text, category text, qty numeric, expiry integer, demand numeric) loop
        insert into public.products(warehouse_id,name,sku,category) values (target_warehouse,product_row.name,product_row.sku,product_row.category) returning id into product_id;
        insert into public.product_batches(product_id,batch_number,quantity,expiry_date) values (product_id, replace(product_row.sku,'BT-','') || '-' || to_char(current_date,'YYMMDD'), product_row.qty, current_date + product_row.expiry) returning id into batch_id;
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
