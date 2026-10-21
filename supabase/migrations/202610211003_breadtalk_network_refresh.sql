-- Rebuild only manifest-tracked BreadTalk history and expand it to nine branches.
-- Untracked warehouses, product catalogs, and the archived empty warehouse are untouched.
create or replace function public.reset_breadtalk_network()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tracked_count integer;
  seeded jsonb;
  base record;
  source_id uuid;
  target_id uuid;
  target_name text;
  product record;
  source_batch record;
  product_id uuid;
  batch_id uuid;
  product_count integer;
  batch_count integer;
  movement_count integer;
  branch_names text[] := array[
    'BreadTalk Central Kitchen', 'BreadTalk Junction 8', 'BreadTalk Airport Hub',
    'BreadTalk Yangon Downtown', 'BreadTalk Insein', 'BreadTalk Mandalay',
    'BreadTalk Naypyidaw', 'BreadTalk Bago', 'BreadTalk Mawlamyine'
  ];
  branch_index integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can rebuild BreadTalk history'; end if;

  select count(*) into tracked_count
  from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id
  where w.name in ('BreadTalk Demo — Central Kitchen','BreadTalk Demo — Junction 8','BreadTalk Demo — Airport Hub');
  if tracked_count <> 3 then
    raise exception 'Expected the three verified manifest-tracked BreadTalk branches; found %', tracked_count;
  end if;
  if exists (
    select 1 from public.warehouses w
    where w.name in ('BreadTalk Demo — Central Kitchen','BreadTalk Demo — Junction 8','BreadTalk Demo — Airport Hub')
      and not exists (select 1 from public.demo_seed_runs r where r.warehouse_id = w.id)
  ) then
    raise exception 'An untracked BreadTalk branch exists; no warehouse data was changed';
  end if;

  create temporary table oceanblue_seed_member_snapshot on commit drop as
  select w.name as old_name, wm.user_id, wm.role
  from public.demo_seed_runs r
  join public.warehouses w on w.id = r.warehouse_id
  join public.warehouse_members wm on wm.warehouse_id = w.id;

  delete from public.warehouses w using public.demo_seed_runs r where r.warehouse_id = w.id;
  seeded := public.seed_breadtalk_history();

  -- The generator's quantities are bakery units. Normalize every event and keep each
  -- current-month receipt equal to remaining stock plus that month's outbound events.
  update public.product_batches b set quantity = round(b.quantity)
    where exists (select 1 from public.products p join public.demo_seed_runs r on r.warehouse_id = p.warehouse_id where p.id = b.product_id);
  update public.stock_movements m set quantity = greatest(1, round(m.quantity))
    where exists (select 1 from public.demo_seed_runs r where r.warehouse_id = m.warehouse_id);
  update public.stock_movements receipt
  set quantity = batch.quantity + coalesce((
    select sum(outbound.quantity) from public.stock_movements outbound
    where outbound.batch_id = receipt.batch_id and outbound.movement_type = 'out'
      and date_trunc('month', outbound.created_at) = date_trunc('month', current_date)
  ), 0)
  from public.product_batches batch
  where receipt.batch_id = batch.id and receipt.movement_type = 'in'
    and receipt.reason = 'Current month production receipt'
    and exists (select 1 from public.demo_seed_runs r where r.warehouse_id = receipt.warehouse_id);

  for base in
    select w.id, w.name from public.demo_seed_runs r
    join public.warehouses w on w.id = r.warehouse_id order by w.created_at, w.id
  loop
    branch_index := case base.name
      when 'BreadTalk Demo — Central Kitchen' then 1
      when 'BreadTalk Demo — Junction 8' then 2
      else 3 end;
    update public.warehouses set name = branch_names[branch_index] where id = base.id;
  end loop;

  -- Keep existing Editor and Viewer assignments for the three original branch names.
  insert into public.warehouse_members(warehouse_id,user_id,role)
  select w.id,snapshot.user_id,snapshot.role
  from pg_temp.oceanblue_seed_member_snapshot snapshot
  join public.warehouses w on w.name = case snapshot.old_name
    when 'BreadTalk Demo — Central Kitchen' then 'BreadTalk Central Kitchen'
    when 'BreadTalk Demo — Junction 8' then 'BreadTalk Junction 8'
    else 'BreadTalk Airport Hub' end
  on conflict (warehouse_id,user_id) do update set role = excluded.role;

  create temporary table oceanblue_seed_product_map(old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table oceanblue_seed_batch_map(old_id uuid primary key, new_id uuid not null) on commit drop;

  for branch_index in 4..9 loop
    source_id := (select r.warehouse_id from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id
      where w.name = branch_names[((branch_index - 1) % 3) + 1] limit 1);
    target_name := branch_names[branch_index];
    insert into public.warehouses(name) values (target_name) returning id into target_id;
    truncate pg_temp.oceanblue_seed_product_map;
    truncate pg_temp.oceanblue_seed_batch_map;

    for product in select * from public.products where warehouse_id = source_id order by sku loop
      insert into public.products(warehouse_id,name,sku,category,created_at,updated_at,archived_at)
      values (target_id,product.name,product.sku,product.category,product.created_at,product.updated_at,product.archived_at)
      returning id into product_id;
      insert into pg_temp.oceanblue_seed_product_map(old_id,new_id) values (product.id,product_id);
      for source_batch in select * from public.product_batches where product_id = product.id order by batch_number loop
        insert into public.product_batches(product_id,batch_number,quantity,expiry_date,created_at)
        values (product_id,source_batch.batch_number,round(source_batch.quantity),source_batch.expiry_date,source_batch.created_at)
        returning id into batch_id;
        insert into pg_temp.oceanblue_seed_batch_map(old_id,new_id) values (source_batch.id,batch_id);
      end loop;
    end loop;

    insert into public.stock_movements(warehouse_id,product_id,batch_id,movement_type,quantity,reason,created_by,created_at)
    select target_id,pm.new_id,bm.new_id,m.movement_type,round(m.quantity),m.reason,m.created_by,m.created_at
    from public.stock_movements m
    join pg_temp.oceanblue_seed_product_map pm on pm.old_id = m.product_id
    left join pg_temp.oceanblue_seed_batch_map bm on bm.old_id = m.batch_id
    where m.warehouse_id = source_id;

    update public.stock_movements receipt set quantity = batch.quantity + coalesce((
      select sum(outbound.quantity) from public.stock_movements outbound
      where outbound.batch_id = receipt.batch_id and outbound.movement_type = 'out'
        and date_trunc('month', outbound.created_at) = date_trunc('month', current_date)
    ), 0)
    from public.product_batches batch
    where receipt.batch_id = batch.id and receipt.warehouse_id = target_id
      and receipt.movement_type = 'in' and receipt.reason = 'Current month production receipt';

    select count(*) into product_count from public.products where warehouse_id = target_id;
    select count(*) into batch_count from public.product_batches b join public.products p on p.id = b.product_id where p.warehouse_id = target_id;
    select count(*) into movement_count from public.stock_movements where warehouse_id = target_id;
    insert into public.demo_seed_runs(warehouse_id,seeded_by,history_start,products_created,batches_created,movements_created)
    select target_id,auth.uid(),min(history_start),product_count,batch_count,movement_count from public.demo_seed_runs where warehouse_id = source_id;
  end loop;

  select count(*) into tracked_count from public.demo_seed_runs r
    join public.warehouses w on w.id = r.warehouse_id where w.name = any(branch_names);
  if tracked_count <> 9 then raise exception 'BreadTalk history rebuild did not produce nine branches'; end if;

  select jsonb_build_object('seeded',true,'warehouses',count(*),
    'products',coalesce(sum(r.products_created),0),'batches',coalesce(sum(r.batches_created),0),
    'movements',coalesce(sum(r.movements_created),0),'history_start',min(r.history_start),'history_end',current_date)
  into seeded from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id
  where w.name = any(branch_names);
  return seeded;
end;
$$;

create or replace function public.ensure_breadtalk_network()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can load BreadTalk history'; end if;
  if (select count(*) from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id
      where w.name like 'BreadTalk %' and w.name not like 'BreadTalk Demo %') <> 9 then
    raise exception 'Use Reset and reload to replace the three-branch history with the nine-branch dataset';
  end if;
  select jsonb_build_object('seeded',false,'already_seeded',true,'warehouses',count(*),
    'products',coalesce(sum(r.products_created),0),'batches',coalesce(sum(r.batches_created),0),
    'movements',coalesce(sum(r.movements_created),0)) into result
  from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id
  where w.name like 'BreadTalk %' and w.name not like 'BreadTalk Demo %';
  return result;
end;
$$;

revoke all on function public.reset_breadtalk_network() from public;
revoke all on function public.ensure_breadtalk_network() from public;
grant execute on function public.reset_breadtalk_network() to authenticated;
grant execute on function public.ensure_breadtalk_network() to authenticated;
