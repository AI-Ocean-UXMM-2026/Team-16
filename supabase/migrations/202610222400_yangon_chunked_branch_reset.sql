-- Replace large cascading branch deletes with manifest-scoped, resumable chunks.
create table if not exists public.yangon_branch_reset_progress (
  warehouse_id uuid primary key,
  phase text not null default 'movements' check (phase in ('movements','batches','products','complete')),
  updated_at timestamptz not null default now()
);
alter table public.yangon_branch_reset_progress enable row level security;
revoke all on public.yangon_branch_reset_progress from public, anon, authenticated;
grant all on public.yangon_branch_reset_progress to service_role;

create or replace function public.prepare_yangon_convenience_reset()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tracked_count integer;
  known_count integer;
  old_count integer;
  yangon_count integer;
  reset_ids uuid[] := array[]::uuid[];
  reset_exists boolean;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can replace the training inventory'; end if;

  select exists(select 1 from public.yangon_branch_reset_progress) into reset_exists;
  if reset_exists then
    select coalesce(array_agg(warehouse_id order by warehouse_id),array[]::uuid[]) into reset_ids
      from public.yangon_branch_reset_progress where phase <> 'complete';
    return jsonb_build_object('warehouse_ids',reset_ids,'replaced',true,'reset_in_progress',true);
  end if;

  select count(*) into tracked_count from public.demo_seed_runs;
  select count(*) into known_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id
  where w.name in (
    'BreadTalk Demo — Central Kitchen','BreadTalk Demo — Junction 8','BreadTalk Demo — Airport Hub',
    'BreadTalk Central Kitchen','BreadTalk Junction 8','BreadTalk Airport Hub','BreadTalk Yangon Downtown',
    'BreadTalk Insein','BreadTalk Mandalay','BreadTalk Naypyidaw','BreadTalk Bago','BreadTalk Mawlamyine',
    'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
    'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
  );
  select count(*) into old_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id where w.name like 'BreadTalk%';
  select count(*) into yangon_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id where w.name in (
    'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
    'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
  );
  if tracked_count <> known_count or tracked_count > 9 or (old_count > 0 and yangon_count > 0) then
    raise exception 'Seed manifest is not a recognized network; no branch was changed';
  end if;
  if exists (
    select 1 from public.warehouses w
    where w.name in ('OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
      'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store')
      and not exists(select 1 from public.demo_seed_runs r where r.warehouse_id=w.id)
      and not exists(select 1 from public.yangon_seed_progress p where p.warehouse_id=w.id)
  ) then raise exception 'A target branch exists outside the seed manifest; no records were removed'; end if;

  if old_count > 0 or yangon_count = 9 then
    insert into public.yangon_network_members(user_id,role)
      select distinct wm.user_id,wm.role from public.warehouse_members wm
      join public.demo_seed_runs r on r.warehouse_id=wm.warehouse_id
      where wm.role in ('editor','viewer') on conflict(user_id) do nothing;
    insert into public.yangon_branch_reset_progress(warehouse_id,phase)
      select r.warehouse_id,'movements' from public.demo_seed_runs r
      union
      select p.warehouse_id,'movements' from public.yangon_seed_progress p
      on conflict(warehouse_id) do nothing;
    select coalesce(array_agg(warehouse_id order by warehouse_id),array[]::uuid[]) into reset_ids
      from public.yangon_branch_reset_progress where phase <> 'complete';
    reset_exists := true;
  end if;
  return jsonb_build_object('warehouse_ids',reset_ids,'replaced',reset_exists,'reset_in_progress',reset_exists);
end;
$$;

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
      select id from public.stock_movements where warehouse_id=p_warehouse_id order by id limit 4000
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
      where p.warehouse_id=p_warehouse_id order by b.id limit 4000
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

create or replace function public.finish_yangon_convenience_reset()
returns jsonb language plpgsql security definer set search_path = public as $$
declare remaining integer;
  queued integer;
begin
  if auth.uid() is null or not public.is_system_admin() then raise exception 'System Admin access is required'; end if;
  select count(*) into queued from public.yangon_branch_reset_progress;
  if queued=0 then return jsonb_build_object('finished',true,'branches',0); end if;
  select count(*) into remaining from public.yangon_branch_reset_progress where phase<>'complete';
  if remaining>0 then raise exception 'The tracked branch reset is not complete'; end if;
  delete from public.yangon_branch_reset_progress where phase='complete';
  return jsonb_build_object('finished',true,'branches',queued);
end;
$$;

revoke all on function public.delete_yangon_manifest_branch(uuid) from public,anon,authenticated;
revoke all on function public.delete_yangon_manifest_branch_chunk(uuid) from public,anon;
revoke all on function public.finish_yangon_convenience_reset() from public,anon;
grant execute on function public.delete_yangon_manifest_branch_chunk(uuid) to authenticated;
grant execute on function public.finish_yangon_convenience_reset() to authenticated;
revoke all on function public.prepare_yangon_convenience_reset() from public,anon;
grant execute on function public.prepare_yangon_convenience_reset() to authenticated;
