-- Replace only manifest-tracked training records with a Yangon convenience-store
-- network. The routine is admin-only, transactional, and refuses unknown manifests.

create or replace function public.seed_yangon_convenience_network()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  branch_names text[] := array[
    'OceanBlue Main Warehouse',
    'Yangon Downtown Convenience Store',
    'Sanchaung Convenience Store',
    'Bahan Convenience Store',
    'Kamayut Convenience Store',
    'Thingangyun Convenience Store',
    'Hlaing Convenience Store',
    'Tamwe Convenience Store',
    'North Dagon Convenience Store'
  ];
  branch_index integer;
  branch_id uuid;
  product_id uuid;
  batch_id uuid;
  item record;
  month_start date;
  history_start date := date '2021-01-01';
  month_count integer;
  month_index integer;
  demand integer;
  on_hand integer;
  out_1 integer;
  out_2 integer;
  out_3 integer;
  out_4 integer;
  movement_count integer := 0;
  batch_count integer := 0;
  product_count integer := 0;
  store_scale numeric;
  current_month date := date_trunc('month', current_date)::date;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can load Yangon inventory'; end if;
  if exists (select 1 from public.demo_seed_runs) then raise exception 'Reset tracked seed records before loading the Yangon network'; end if;
  if exists (select 1 from public.warehouses where name = any(branch_names)) then
    raise exception 'A Yangon network branch already exists outside the seed manifest; no existing branch was changed';
  end if;
  if not exists (select 1 from public.product_categories where lower(name) = 'beverages') then insert into public.product_categories(name) values ('Beverages'); end if;
  insert into public.product_categories(name) values ('Snacks'),('Instant food'),('Dairy'),('Bakery'),('Pantry'),('Personal care'),('Household') on conflict do nothing;
  month_count := ((extract(year from current_month)::integer - 2021) * 12) + extract(month from current_month)::integer;

  for branch_index in 1..array_length(branch_names, 1) loop
    insert into public.warehouses(name) values (branch_names[branch_index]) returning id into branch_id;
    store_scale := case when branch_index = 1 then 7.0 else 0.75 + (branch_index * 0.06) end;
    for item in select * from (values
      ('Bottled water 600 ml','Beverages',420,7),('Bottled water 1.5 L','Beverages',180,7),('Cola 330 ml','Beverages',260,180),('Orange drink 350 ml','Beverages',190,180),('Energy drink 250 ml','Beverages',145,270),('Green tea 500 ml','Beverages',140,180),('UHT milk 1 L','Dairy',100,180),('Fresh milk 1 L','Dairy',75,10),('Yogurt cup 150 g','Dairy',105,14),('Butter 200 g','Dairy',38,60),
      ('Instant noodles chicken','Instant food',330,270),('Instant noodles seafood','Instant food',230,270),('Instant rice porridge','Instant food',95,270),('Canned sardines','Pantry',110,730),('Canned tuna','Pantry',92,730),('Canned sweet corn','Pantry',54,730),('White rice 1 kg','Pantry',72,365),('Cooking oil 1 L','Pantry',58,365),('Fish sauce 300 ml','Pantry',45,730),('Soy sauce 300 ml','Pantry',42,730),
      ('Potato chips original','Snacks',190,120),('Potato chips spicy','Snacks',165,120),('Crackers salted','Snacks',135,180),('Chocolate wafer','Snacks',170,180),('Peanut snack pack','Snacks',115,120),('Roasted peanuts 100 g','Snacks',72,120),('Chocolate bar','Snacks',105,240),('Hard candy bag','Snacks',65,365),('White bread loaf','Bakery',75,3),('Sweet bun','Bakery',100,3),
      ('Eggs 10 pack','Dairy',62,14),('Cheddar slices 10 pack','Dairy',40,45),('Instant coffee sachets','Beverages',170,365),('3-in-1 coffee sachets','Beverages',150,365),('Black tea bags 25 pack','Beverages',48,365),('Toothpaste 100 g','Personal care',36,1095),('Toothbrush single','Personal care',30,1095),('Laundry detergent 500 g','Household',44,730),('Dishwashing liquid 500 ml','Household',40,730),('Tissue pack','Household',96,730)
    ) as catalog(name, category, monthly_demand, shelf_days) loop
      insert into public.products(warehouse_id,name,sku,category,created_at)
        values (branch_id,item.name,'YGN-'||lpad(branch_index::text,2,'0')||'-'||lpad(((product_count - 1) % 40 + 1)::text,3,'0'),item.category,history_start::timestamptz)
        returning id into product_id;
      product_count := product_count + 1;
      month_index := 0;
      for month_start in select generate_series(history_start::timestamp,current_month::timestamp,interval '1 month')::date loop
        demand := greatest(1,round(item.monthly_demand * store_scale * (1 + (((month_index + product_count * 3) % 9) - 4) * 0.025))::integer);
        on_hand := greatest(1,round(demand * case when item.shelf_days <= 3 then 0.16 else 0.22 end)::integer);
        insert into public.product_batches(product_id,batch_number,quantity,expiry_date,created_at)
          values(product_id,'Y'||to_char(month_start,'YYMM')||'-'||lpad(((product_count - 1) % 40 + 1)::text,3,'0'),
            case when month_start = current_month then on_hand else 0 end,
            case when month_start = current_month then current_date + item.shelf_days else month_start + item.shelf_days end,
            month_start::timestamptz + interval '1 day') returning id into batch_id;
        batch_count := batch_count + 1;
        if month_start < current_month then
          insert into public.stock_movements(warehouse_id,product_id,batch_id,movement_type,quantity,reason,created_by,created_at) values
            (branch_id,product_id,batch_id,'in',demand,'Monthly store replenishment',auth.uid(),month_start::timestamptz + interval '2 days 8 hours'),
            (branch_id,product_id,batch_id,'out',demand,case when month_index % 2 = 0 then 'Retail customer sales' else 'Neighborhood store sales' end,auth.uid(),month_start::timestamptz + interval '18 days 17 hours');
          movement_count := movement_count + 2;
        else
          out_1 := greatest(1,round(demand * 0.18)::integer); out_2 := greatest(1,round(demand * 0.19)::integer);
          out_3 := greatest(1,round(demand * 0.17)::integer); out_4 := greatest(1,round(demand * 0.21)::integer);
          insert into public.stock_movements(warehouse_id,product_id,batch_id,movement_type,quantity,reason,created_by,created_at) values
            (branch_id,product_id,batch_id,'in',on_hand+out_1+out_2+out_3+out_4,'Current month replenishment',auth.uid(),(current_date-30)::timestamptz+interval '8 hours'),
            (branch_id,product_id,batch_id,'out',out_1,'Morning retail sales',auth.uid(),(current_date-24)::timestamptz+interval '10 hours'),
            (branch_id,product_id,batch_id,'out',out_2,'Evening retail sales',auth.uid(),(current_date-17)::timestamptz+interval '18 hours'),
            (branch_id,product_id,batch_id,'out',out_3,'Morning retail sales',auth.uid(),(current_date-10)::timestamptz+interval '10 hours'),
            (branch_id,product_id,batch_id,'out',out_4,'Evening retail sales',auth.uid(),(current_date-3)::timestamptz+interval '18 hours');
          movement_count := movement_count + 5;
        end if;
        month_index := month_index + 1;
      end loop;
    end loop;
    insert into public.demo_seed_runs(warehouse_id,seeded_by,history_start,products_created,batches_created,movements_created)
      values(branch_id,auth.uid(),history_start,40,40*month_count,40*((month_count-1)*2+5));
  end loop;
  return jsonb_build_object('seeded',true,'warehouses',array_length(branch_names,1),'products',product_count,'batches',batch_count,'movements',movement_count,'history_start',history_start,'history_end',current_date);
end;
$$;

create or replace function public.reset_yangon_convenience_network()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tracked_count integer;
  expected_count integer;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can replace the training inventory'; end if;
  select count(*) into tracked_count from public.demo_seed_runs;
  select count(*) into expected_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id
    where w.name in (
      'BreadTalk Demo — Central Kitchen','BreadTalk Demo — Junction 8','BreadTalk Demo — Airport Hub',
      'BreadTalk Central Kitchen','BreadTalk Junction 8','BreadTalk Airport Hub','BreadTalk Yangon Downtown',
      'BreadTalk Insein','BreadTalk Mandalay','BreadTalk Naypyidaw','BreadTalk Bago','BreadTalk Mawlamyine',
      'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
      'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
    );
  if tracked_count <> expected_count or tracked_count not in (0,3,9) then
    raise exception 'Seed manifest is not the verified 3-branch or 9-branch set; no records were removed';
  end if;
  if exists (select 1 from public.warehouses w where w.name in (
    'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
    'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
  ) and not exists(select 1 from public.demo_seed_runs r where r.warehouse_id=w.id)) then
    raise exception 'A target branch exists outside the seed manifest; no records were removed';
  end if;
  create temporary table oceanblue_yangon_member_snapshot on commit drop as
    select distinct wm.user_id, wm.role from public.warehouse_members wm
    join public.demo_seed_runs r on r.warehouse_id=wm.warehouse_id;
  delete from public.warehouses w using public.demo_seed_runs r where r.warehouse_id=w.id;
  result := public.seed_yangon_convenience_network();
  insert into public.warehouse_members(warehouse_id,user_id,role)
    select r.warehouse_id,s.user_id,s.role from public.demo_seed_runs r cross join pg_temp.oceanblue_yangon_member_snapshot s
    on conflict(warehouse_id,user_id) do nothing;
  return result || jsonb_build_object('replaced',tracked_count > 0);
end;
$$;

revoke all on function public.seed_yangon_convenience_network() from public;
revoke all on function public.reset_yangon_convenience_network() from public;
grant execute on function public.seed_yangon_convenience_network() to authenticated;
grant execute on function public.reset_yangon_convenience_network() to authenticated;
revoke all on function public.seed_breadtalk_demo() from public, authenticated;
revoke all on function public.seed_breadtalk_history() from public, authenticated;
revoke all on function public.reset_breadtalk_history() from public, authenticated;
revoke all on function public.reset_breadtalk_network() from public, authenticated;
revoke all on function public.ensure_breadtalk_network() from public, authenticated;

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
  if p_quantity is null or p_quantity <= 0 or p_quantity <> trunc(p_quantity) then raise exception 'Quantity must be a positive whole number'; end if;
  if not (public.is_system_admin() or exists(select 1 from public.warehouse_members where warehouse_id=p_warehouse_id and user_id=auth.uid() and role='editor')) then raise exception 'Editor access is required for this warehouse'; end if;
  if not exists(select 1 from public.products where id=p_product_id and warehouse_id=p_warehouse_id) then raise exception 'Product does not belong to this warehouse'; end if;
  if p_movement_type='in' and p_batch_id is null then
    if nullif(trim(coalesce(p_batch_number,'')),'') is null then raise exception 'A batch number is required for Stock In'; end if;
    if p_expiry_date is null then raise exception 'An expiry date is required for inbound stock'; end if;
    insert into public.product_batches(product_id,batch_number,quantity,expiry_date) values(p_product_id,trim(p_batch_number),p_quantity,p_expiry_date)
      on conflict(product_id,batch_number) do update set quantity=public.product_batches.quantity+excluded.quantity,expiry_date=excluded.expiry_date returning * into target_batch;
  else
    if p_batch_id is null then raise exception 'A batch is required for Stock Out'; end if;
    select * into target_batch from public.product_batches where id=p_batch_id and product_id=p_product_id for update;
    if not found then raise exception 'The selected batch was not found'; end if;
    if p_movement_type='out' and target_batch.quantity<p_quantity then raise exception 'Stock Out cannot exceed the available batch quantity'; end if;
    update public.product_batches set quantity=case when p_movement_type='in' then quantity+p_quantity else quantity-p_quantity end where id=target_batch.id returning * into target_batch;
  end if;
  insert into public.stock_movements(warehouse_id,product_id,batch_id,movement_type,quantity,reason,created_by)
    values(p_warehouse_id,p_product_id,target_batch.id,p_movement_type,p_quantity,nullif(trim(coalesce(p_reason,'')),''),auth.uid()) returning id into movement_id;
  return jsonb_build_object('movement_id',movement_id,'batch_id',target_batch.id,'available_in_batch',target_batch.quantity);
end;
$$;
revoke all on function public.record_stock_movement(uuid,uuid,public.movement_type,numeric,uuid,text,date,text) from public;
grant execute on function public.record_stock_movement(uuid,uuid,public.movement_type,numeric,uuid,text,date,text) to authenticated;
