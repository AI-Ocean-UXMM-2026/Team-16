-- Make the Yangon reset resumable and split work into one branch per RPC so
-- Supabase's per-statement timeout cannot cancel a full-network transaction.

create table if not exists public.yangon_network_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','viewer'))
);
alter table public.yangon_network_members enable row level security;
revoke all on public.yangon_network_members from public, anon, authenticated;
grant all on public.yangon_network_members to service_role;

create or replace function public.prepare_yangon_convenience_reset()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tracked_count integer;
  known_count integer;
  old_count integer;
  yangon_count integer;
  reset_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can replace the training inventory'; end if;

  select count(*) into tracked_count from public.demo_seed_runs;
  select count(*) into known_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id
  where w.name in (
    'BreadTalk Demo — Central Kitchen','BreadTalk Demo — Junction 8','BreadTalk Demo — Airport Hub',
    'BreadTalk Central Kitchen','BreadTalk Junction 8','BreadTalk Airport Hub','BreadTalk Yangon Downtown',
    'BreadTalk Insein','BreadTalk Mandalay','BreadTalk Naypyidaw','BreadTalk Bago','BreadTalk Mawlamyine',
    'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
    'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
  );
  select count(*) into old_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id
    where w.name like 'BreadTalk%';
  select count(*) into yangon_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id
    where w.name in ('OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
      'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store');
  if tracked_count <> known_count or tracked_count > 9 or (old_count > 0 and yangon_count > 0) then
    raise exception 'Seed manifest is not a recognized network; no branch was changed';
  end if;
  if exists (select 1 from public.warehouses w where w.name in (
    'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
    'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
  ) and not exists(select 1 from public.demo_seed_runs r where r.warehouse_id=w.id)) then
    raise exception 'A target branch exists outside the seed manifest; no records were removed';
  end if;

  if old_count > 0 or yangon_count = 9 then
    insert into public.yangon_network_members(user_id,role)
      select distinct wm.user_id,wm.role from public.warehouse_members wm
      join public.demo_seed_runs r on r.warehouse_id=wm.warehouse_id
      where wm.role in ('editor','viewer') on conflict(user_id) do nothing;
    select coalesce(array_agg(r.warehouse_id),array[]::uuid[]) into reset_ids
      from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id;
  end if;
  return jsonb_build_object('warehouse_ids',reset_ids,'replaced',cardinality(reset_ids)>0,'resume_existing',yangon_count between 1 and 8);
end;
$$;

create or replace function public.delete_yangon_manifest_branch(p_warehouse_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_system_admin() then raise exception 'System Admin access is required'; end if;
  if not exists(select 1 from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id where r.warehouse_id=p_warehouse_id
    and (w.name like 'BreadTalk%' or w.name in ('OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
      'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'))) then
    raise exception 'The requested branch is not a recognized manifest-tracked seed branch';
  end if;
  delete from public.warehouses where id=p_warehouse_id;
  return true;
end;
$$;

create or replace function public.seed_yangon_convenience_branch(p_branch_index integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  branch_names text[] := array[
    'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
    'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
  ];
  branch_id uuid;
  history_start date := date '2021-01-01';
  current_month date := date_trunc('month',current_date)::date;
  month_count integer;
  scale_value numeric;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can load Yangon inventory'; end if;
  if p_branch_index not between 1 and 9 then raise exception 'Choose a branch index from 1 to 9'; end if;
  if exists(select 1 from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id where w.name=branch_names[p_branch_index]) then
    select jsonb_build_object('seeded',false,'already_seeded',true,'warehouses',1,'products',r.products_created,'batches',r.batches_created,'movements',r.movements_created)
      into result from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id where w.name=branch_names[p_branch_index];
    return result;
  end if;
  if exists(select 1 from public.warehouses where name=branch_names[p_branch_index]) then raise exception 'A target branch already exists outside the manifest'; end if;

  if not exists(select 1 from public.product_categories where lower(name)='beverages') then insert into public.product_categories(name) values('Beverages'); end if;
  insert into public.product_categories(name) values('Snacks'),('Instant food'),('Dairy'),('Bakery'),('Pantry'),('Personal care'),('Household') on conflict do nothing;
  insert into public.warehouses(name) values(branch_names[p_branch_index]) returning id into branch_id;
  scale_value := case when p_branch_index=1 then 7.0 else 0.75+(p_branch_index*0.06) end;
  month_count := ((extract(year from current_month)::integer-2021)*12)+extract(month from current_month)::integer;

  create temporary table oceanblue_yangon_catalog on commit drop as
  select row_number() over()::integer as product_index, v.* from (values
    ('Bottled water 600 ml','Beverages',420,7),('Bottled water 1.5 L','Beverages',180,7),('Cola 330 ml','Beverages',260,180),('Orange drink 350 ml','Beverages',190,180),('Energy drink 250 ml','Beverages',145,270),('Green tea 500 ml','Beverages',140,180),('UHT milk 1 L','Dairy',100,180),('Fresh milk 1 L','Dairy',75,10),('Yogurt cup 150 g','Dairy',105,14),('Butter 200 g','Dairy',38,60),
    ('Instant noodles chicken','Instant food',330,270),('Instant noodles seafood','Instant food',230,270),('Instant rice porridge','Instant food',95,270),('Canned sardines','Pantry',110,730),('Canned tuna','Pantry',92,730),('Canned sweet corn','Pantry',54,730),('White rice 1 kg','Pantry',72,365),('Cooking oil 1 L','Pantry',58,365),('Fish sauce 300 ml','Pantry',45,730),('Soy sauce 300 ml','Pantry',42,730),
    ('Potato chips original','Snacks',190,120),('Potato chips spicy','Snacks',165,120),('Crackers salted','Snacks',135,180),('Chocolate wafer','Snacks',170,180),('Peanut snack pack','Snacks',115,120),('Roasted peanuts 100 g','Snacks',72,120),('Chocolate bar','Snacks',105,240),('Hard candy bag','Snacks',65,365),('White bread loaf','Bakery',75,3),('Sweet bun','Bakery',100,3),
    ('Eggs 10 pack','Dairy',62,14),('Cheddar slices 10 pack','Dairy',40,45),('Instant coffee sachets','Beverages',170,365),('3-in-1 coffee sachets','Beverages',150,365),('Black tea bags 25 pack','Beverages',48,365),('Toothpaste 100 g','Personal care',36,1095),('Toothbrush single','Personal care',30,1095),('Laundry detergent 500 g','Household',44,730),('Dishwashing liquid 500 ml','Household',40,730),('Tissue pack','Household',96,730)
  ) as v(name,category,monthly_demand,shelf_days);

  insert into public.products(warehouse_id,name,sku,category,created_at)
    select branch_id,c.name,'YGN-'||lpad(p_branch_index::text,2,'0')||'-'||lpad(c.product_index::text,3,'0'),c.category,history_start::timestamptz from pg_temp.oceanblue_yangon_catalog c;

  create temporary table oceanblue_yangon_events on commit drop as
  select p.id as product_id,c.product_index,c.monthly_demand,c.shelf_days,g.month_start::date as month_start,
    greatest(1,round(c.monthly_demand*scale_value*(1+((((extract(year from g.month_start)::integer-2021)*12+extract(month from g.month_start)::integer-1+c.product_index*3)%9)-4)*0.025))::integer) as demand,
    greatest(1,round(c.monthly_demand*scale_value*(1+((((extract(year from g.month_start)::integer-2021)*12+extract(month from g.month_start)::integer-1+c.product_index*3)%9)-4)*0.025)*case when c.shelf_days<=3 then 0.16 else 0.22 end)::integer) as on_hand
  from pg_temp.oceanblue_yangon_catalog c
  join public.products p on p.warehouse_id=branch_id and p.sku='YGN-'||lpad(p_branch_index::text,2,'0')||'-'||lpad(c.product_index::text,3,'0')
  cross join lateral generate_series(history_start::timestamp,current_month::timestamp,interval '1 month') g(month_start);

  create temporary table oceanblue_yangon_batch_map(product_id uuid,batch_number text,batch_id uuid) on commit drop;
  with created as (
    insert into public.product_batches(product_id,batch_number,quantity,expiry_date,created_at)
    select e.product_id,'Y'||to_char(e.month_start,'YYMM')||'-'||lpad(e.product_index::text,3,'0'),
      case when e.month_start=current_month then e.on_hand else 0 end,
      case when e.month_start=current_month then current_date+e.shelf_days else e.month_start+e.shelf_days end,
      e.month_start::timestamptz+interval '1 day'
    from pg_temp.oceanblue_yangon_events e returning id,product_id,batch_number
  ) insert into pg_temp.oceanblue_yangon_batch_map select product_id,batch_number,id from created;

  insert into public.stock_movements(warehouse_id,product_id,batch_id,movement_type,quantity,reason,created_by,created_at)
  select branch_id,e.product_id,b.batch_id,x.movement_type,x.quantity,x.reason,auth.uid(),x.created_at
  from pg_temp.oceanblue_yangon_events e join pg_temp.oceanblue_yangon_batch_map b on b.product_id=e.product_id and b.batch_number='Y'||to_char(e.month_start,'YYMM')||'-'||lpad(e.product_index::text,3,'0')
  cross join lateral (
    select 'in'::public.movement_type as movement_type,e.demand as quantity,'Monthly store replenishment'::text as reason,e.month_start::timestamptz+interval '2 days 8 hours' as created_at where e.month_start<current_month
    union all select 'out'::public.movement_type,e.demand,case when ((extract(year from e.month_start)::integer-2021)*12+extract(month from e.month_start)::integer-1)%2=0 then 'Retail customer sales' else 'Neighborhood store sales' end,e.month_start::timestamptz+interval '18 days 17 hours' where e.month_start<current_month
    union all select 'in'::public.movement_type,e.on_hand+greatest(1,round(e.demand*0.18)::integer)+greatest(1,round(e.demand*0.19)::integer)+greatest(1,round(e.demand*0.17)::integer)+greatest(1,round(e.demand*0.21)::integer),'Current month replenishment',(current_date-30)::timestamptz+interval '8 hours' where e.month_start=current_month
    union all select 'out'::public.movement_type,greatest(1,round(e.demand*0.18)::integer),'Morning retail sales',(current_date-24)::timestamptz+interval '10 hours' where e.month_start=current_month
    union all select 'out'::public.movement_type,greatest(1,round(e.demand*0.19)::integer),'Evening retail sales',(current_date-17)::timestamptz+interval '18 hours' where e.month_start=current_month
    union all select 'out'::public.movement_type,greatest(1,round(e.demand*0.17)::integer),'Morning retail sales',(current_date-10)::timestamptz+interval '10 hours' where e.month_start=current_month
    union all select 'out'::public.movement_type,greatest(1,round(e.demand*0.21)::integer),'Evening retail sales',(current_date-3)::timestamptz+interval '18 hours' where e.month_start=current_month
  ) x;

  insert into public.warehouse_members(warehouse_id,user_id,role)
    select branch_id,user_id,role from public.yangon_network_members on conflict(warehouse_id,user_id) do nothing;
  insert into public.demo_seed_runs(warehouse_id,seeded_by,history_start,products_created,batches_created,movements_created)
    select branch_id,auth.uid(),history_start,40,count(*),count(*) filter(where month_start<current_month)*2+40*5 from pg_temp.oceanblue_yangon_events;
  select jsonb_build_object('seeded',true,'already_seeded',false,'warehouses',1,'products',40,'batches',count(*),'movements',count(*) filter(where month_start<current_month)*2+40*5,'history_start',history_start,'history_end',current_date)
    into result from pg_temp.oceanblue_yangon_events;
  return result;
end;
$$;

revoke all on function public.prepare_yangon_convenience_reset() from public,anon;
revoke all on function public.delete_yangon_manifest_branch(uuid) from public,anon;
revoke all on function public.seed_yangon_convenience_branch(integer) from public,anon;
grant execute on function public.prepare_yangon_convenience_reset() to authenticated;
grant execute on function public.delete_yangon_manifest_branch(uuid) to authenticated;
grant execute on function public.seed_yangon_convenience_branch(integer) to authenticated;

-- Prevent the old all-in-one functions from being called by authenticated clients.
revoke all on function public.reset_yangon_convenience_network() from public, anon, authenticated;
revoke all on function public.seed_yangon_convenience_network() from public, anon, authenticated;
