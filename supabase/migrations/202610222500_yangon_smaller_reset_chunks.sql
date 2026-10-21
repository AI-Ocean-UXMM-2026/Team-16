-- Supabase plan statement timeouts can be lower than expected for large deletes.
-- Keep each unit of work to 1,000 indexed rows and avoid sorting the batch set.
create or replace function public.delete_yangon_manifest_branch_chunk(p_warehouse_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_phase text;
  removed_count integer := 0;
  recognized boolean;
begin
  if auth.uid() is null or not public.is_system_admin() then raise exception 'System Admin access is required'; end if;
  select phase into current_phase from public.yangon_branch_reset_progress where warehouse_id=p_warehouse_id for update;
  if current_phase is null then raise exception 'The warehouse is not queued for a tracked reset'; end if;
  if current_phase='complete' then return jsonb_build_object('done',true,'deleted',0); end if;

  select exists(
    select 1 from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id
    where r.warehouse_id=p_warehouse_id and (w.name like 'BreadTalk%' or w.name in (
      'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
      'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
    ))
    union all
    select 1 from public.yangon_seed_progress p join public.warehouses w on w.id=p.warehouse_id
    where p.warehouse_id=p_warehouse_id and w.name in (
      'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
      'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
    )
  ) into recognized;
  if not recognized then raise exception 'The warehouse is not a recognized manifest-tracked seed branch'; end if;

  if current_phase='movements' then
    with targets as (
      select id from public.stock_movements where warehouse_id=p_warehouse_id order by created_at desc limit 1000
    ), removed as (
      delete from public.stock_movements m using targets t where m.id=t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count>0 then return jsonb_build_object('done',false,'phase','movements','deleted',removed_count); end if;
    update public.yangon_branch_reset_progress set phase='batches',updated_at=now() where warehouse_id=p_warehouse_id;
    current_phase:='batches';
  end if;

  if current_phase='batches' then
    with targets as (
      select b.id from public.product_batches b join public.products p on p.id=b.product_id
      where p.warehouse_id=p_warehouse_id order by b.product_id,b.batch_number limit 1000
    ), removed as (
      delete from public.product_batches b using targets t where b.id=t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count>0 then return jsonb_build_object('done',false,'phase','batches','deleted',removed_count); end if;
    update public.yangon_branch_reset_progress set phase='products',updated_at=now() where warehouse_id=p_warehouse_id;
    current_phase:='products';
  end if;

  if current_phase='products' then
    with targets as (
      select id from public.products where warehouse_id=p_warehouse_id order by id limit 500
    ), removed as (
      delete from public.products p using targets t where p.id=t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count>0 then return jsonb_build_object('done',false,'phase','products','deleted',removed_count); end if;

    delete from public.demo_seed_runs where warehouse_id=p_warehouse_id;
    delete from public.yangon_seed_progress where warehouse_id=p_warehouse_id;
    delete from public.warehouses where id=p_warehouse_id and name in (
      'BreadTalk Demo — Central Kitchen','BreadTalk Demo — Junction 8','BreadTalk Demo — Airport Hub',
      'BreadTalk Central Kitchen','BreadTalk Junction 8','BreadTalk Airport Hub','BreadTalk Yangon Downtown',
      'BreadTalk Insein','BreadTalk Mandalay','BreadTalk Naypyidaw','BreadTalk Bago','BreadTalk Mawlamyine',
      'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
      'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
    );
    update public.yangon_branch_reset_progress set phase='complete',updated_at=now() where warehouse_id=p_warehouse_id;
    return jsonb_build_object('done',true,'phase','complete','deleted',removed_count);
  end if;
  return jsonb_build_object('done',false,'phase',current_phase,'deleted',0);
end;
$$;

revoke all on function public.delete_yangon_manifest_branch_chunk(uuid) from public,anon;
grant execute on function public.delete_yangon_manifest_branch_chunk(uuid) to authenticated;
