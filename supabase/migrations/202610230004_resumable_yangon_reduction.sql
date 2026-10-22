-- Queue only the five peripheral tracked branches for resumable removal.
-- Actual row deletion is performed in separate RPC transactions, not here.
create table if not exists public.yangon_training_reduction_progress (
  warehouse_id uuid primary key,
  phase text not null default 'movements'
    check (phase in ('movements', 'batches', 'products', 'complete')),
  updated_at timestamptz not null default now()
);
alter table public.yangon_training_reduction_progress enable row level security;
revoke all on public.yangon_training_reduction_progress from public, anon, authenticated;
grant all on public.yangon_training_reduction_progress to service_role;

create or replace function public.prepare_yangon_training_reduction()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ids uuid[];
  tracked_count integer;
  known_count integer;
  pending_count integer;
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'Only a System Admin can reduce the training network';
  end if;

  -- A previous attempt may already have deleted some branches. In that case,
  -- return the original durable queue and continue rather than revalidating a
  -- now-smaller manifest or starting a second cleanup.
  select coalesce(array_agg(warehouse_id order by warehouse_id), array[]::uuid[])
    into target_ids
  from public.yangon_training_reduction_progress;
  if coalesce(cardinality(target_ids), 0) > 0 then
    select count(*) into pending_count
    from public.yangon_training_reduction_progress
    where phase <> 'complete';
    return jsonb_build_object(
      'warehouse_ids', target_ids,
      'remaining_branches', pending_count,
      'resumed', true
    );
  end if;

  select count(*) into tracked_count from public.demo_seed_runs;
  select count(*) into known_count
  from public.demo_seed_runs r
  join public.warehouses w on w.id = r.warehouse_id
  where w.name in (
    'OceanBlue Main Warehouse',
    'Yangon Downtown Convenience Store',
    'Sanchaung Convenience Store',
    'Bahan Convenience Store',
    'Kamayut Convenience Store',
    'Thingangyun Convenience Store',
    'Hlaing Convenience Store',
    'Tamwe Convenience Store',
    'North Dagon Convenience Store'
  );
  if tracked_count <> 9 or known_count <> 9 then
    raise exception 'Cleanup stopped because the tracked branch list does not match the expected nine-branch network. No data was changed.';
  end if;

  if exists (
    select 1 from public.yangon_seed_progress p
    join public.warehouses w on w.id = p.warehouse_id
    where w.name in (
      'OceanBlue Main Warehouse',
      'Yangon Downtown Convenience Store',
      'Sanchaung Convenience Store',
      'Bahan Convenience Store',
      'Kamayut Convenience Store',
      'Thingangyun Convenience Store',
      'Hlaing Convenience Store',
      'Tamwe Convenience Store',
      'North Dagon Convenience Store'
    )
  ) then
    raise exception 'Cleanup stopped because a network load is still in progress. Finish or cancel that load first.';
  end if;

  select array_agg(w.id order by w.name) into target_ids
  from public.demo_seed_runs r
  join public.warehouses w on w.id = r.warehouse_id
  where w.name in (
    'Kamayut Convenience Store',
    'Thingangyun Convenience Store',
    'Hlaing Convenience Store',
    'Tamwe Convenience Store',
    'North Dagon Convenience Store'
  );
  if coalesce(cardinality(target_ids), 0) <> 5 then
    raise exception 'Cleanup stopped because the five selected tracked branches were not found. No data was changed.';
  end if;

  insert into public.yangon_training_reduction_progress (warehouse_id, phase)
  select id, 'movements' from unnest(target_ids) as targets(id);

  return jsonb_build_object(
    'warehouse_ids', target_ids,
    'remaining_branches', cardinality(target_ids),
    'resumed', false
  );
end;
$$;

create or replace function public.delete_yangon_training_branch_chunk(p_warehouse_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_phase text;
  removed_count integer := 0;
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'Only a System Admin can reduce the training network';
  end if;

  select phase into current_phase
  from public.yangon_training_reduction_progress
  where warehouse_id = p_warehouse_id
  for update;
  if current_phase is null then
    raise exception 'This branch is not in the tracked network cleanup queue';
  end if;
  if current_phase = 'complete' then
    return jsonb_build_object('done', true, 'deleted', 0, 'phase', 'complete');
  end if;

  if current_phase = 'movements' then
    with targets as (
      select id from public.stock_movements where warehouse_id = p_warehouse_id limit 1000
    ), removed as (
      delete from public.stock_movements m using targets t where m.id = t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count > 0 then
      return jsonb_build_object('done', false, 'phase', 'movements', 'deleted', removed_count);
    end if;
    update public.yangon_training_reduction_progress
    set phase = 'batches', updated_at = now() where warehouse_id = p_warehouse_id;
    current_phase := 'batches';
  end if;

  if current_phase = 'batches' then
    with targets as (
      select b.id from public.product_batches b
      join public.products p on p.id = b.product_id
      where p.warehouse_id = p_warehouse_id limit 1000
    ), removed as (
      delete from public.product_batches b using targets t where b.id = t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count > 0 then
      return jsonb_build_object('done', false, 'phase', 'batches', 'deleted', removed_count);
    end if;
    update public.yangon_training_reduction_progress
    set phase = 'products', updated_at = now() where warehouse_id = p_warehouse_id;
    current_phase := 'products';
  end if;

  if current_phase = 'products' then
    with targets as (
      select id from public.products where warehouse_id = p_warehouse_id limit 200
    ), removed as (
      delete from public.products p using targets t where p.id = t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count > 0 then
      return jsonb_build_object('done', false, 'phase', 'products', 'deleted', removed_count);
    end if;

    delete from public.yangon_seed_progress where warehouse_id = p_warehouse_id;
    delete from public.warehouse_members where warehouse_id = p_warehouse_id;
    delete from public.demo_seed_runs where warehouse_id = p_warehouse_id;
    delete from public.warehouses where id = p_warehouse_id and name in (
      'Kamayut Convenience Store',
      'Thingangyun Convenience Store',
      'Hlaing Convenience Store',
      'Tamwe Convenience Store',
      'North Dagon Convenience Store'
    );
    if not found then
      raise exception 'Cleanup stopped because a target branch no longer matches the tracked branch list';
    end if;
    update public.yangon_training_reduction_progress
    set phase = 'complete', updated_at = now() where warehouse_id = p_warehouse_id;
    return jsonb_build_object('done', true, 'phase', 'complete', 'deleted', removed_count);
  end if;
  return jsonb_build_object('done', false, 'phase', current_phase, 'deleted', 0);
end;
$$;

create or replace function public.finish_yangon_training_reduction()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_count integer;
  completed_count integer;
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'Only a System Admin can finish the training network cleanup';
  end if;

  select count(*) filter (where phase <> 'complete'), count(*)
    into pending_count, completed_count
  from public.yangon_training_reduction_progress;
  if pending_count > 0 then
    raise exception 'Cleanup is still in progress. Resume the remaining branch chunks first.';
  end if;
  delete from public.yangon_training_reduction_progress where phase = 'complete';
  return jsonb_build_object('finished', true, 'branches', completed_count);
end;
$$;

revoke all on function public.prepare_yangon_training_reduction() from public, anon;
revoke all on function public.delete_yangon_training_branch_chunk(uuid) from public, anon;
revoke all on function public.finish_yangon_training_reduction() from public, anon;
grant execute on function public.prepare_yangon_training_reduction() to authenticated;
grant execute on function public.delete_yangon_training_branch_chunk(uuid) to authenticated;
grant execute on function public.finish_yangon_training_reduction() to authenticated;
