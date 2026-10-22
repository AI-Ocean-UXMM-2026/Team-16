-- Avoid scanning all stock history for every resumable cleanup chunk.
create index if not exists stock_movements_warehouse_id_idx
  on public.stock_movements (warehouse_id);

-- Keep each deletion transaction small enough for hosted Postgres timeouts.
create or replace function public.delete_yangon_training_branch_chunk(p_warehouse_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_phase text;
  removed_count integer := 0;
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'Only a System Admin can reduce the training network';
  end if;
  select phase into current_phase from public.yangon_training_reduction_progress
  where warehouse_id = p_warehouse_id for update;
  if current_phase is null then raise exception 'This branch is not in the tracked network cleanup queue'; end if;
  if current_phase = 'complete' then return jsonb_build_object('done', true, 'deleted', 0, 'phase', 'complete'); end if;

  if current_phase = 'movements' then
    with targets as (
      select id from public.stock_movements where warehouse_id = p_warehouse_id limit 250
    ), removed as (
      delete from public.stock_movements m using targets t where m.id = t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count > 0 then return jsonb_build_object('done', false, 'phase', 'movements', 'deleted', removed_count); end if;
    update public.yangon_training_reduction_progress set phase = 'batches', updated_at = now() where warehouse_id = p_warehouse_id;
    current_phase := 'batches';
  end if;

  if current_phase = 'batches' then
    with targets as (
      select b.id from public.product_batches b join public.products p on p.id = b.product_id
      where p.warehouse_id = p_warehouse_id limit 250
    ), removed as (
      delete from public.product_batches b using targets t where b.id = t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count > 0 then return jsonb_build_object('done', false, 'phase', 'batches', 'deleted', removed_count); end if;
    update public.yangon_training_reduction_progress set phase = 'products', updated_at = now() where warehouse_id = p_warehouse_id;
    current_phase := 'products';
  end if;

  if current_phase = 'products' then
    with targets as (
      select id from public.products where warehouse_id = p_warehouse_id limit 50
    ), removed as (
      delete from public.products p using targets t where p.id = t.id returning 1
    ) select count(*) into removed_count from removed;
    if removed_count > 0 then return jsonb_build_object('done', false, 'phase', 'products', 'deleted', removed_count); end if;
    delete from public.yangon_seed_progress where warehouse_id = p_warehouse_id;
    delete from public.warehouse_members where warehouse_id = p_warehouse_id;
    delete from public.demo_seed_runs where warehouse_id = p_warehouse_id;
    delete from public.warehouses where id = p_warehouse_id and name in (
      'Kamayut Convenience Store', 'Thingangyun Convenience Store', 'Hlaing Convenience Store',
      'Tamwe Convenience Store', 'North Dagon Convenience Store'
    );
    if not found then raise exception 'Cleanup stopped because a target branch no longer matches the tracked branch list'; end if;
    update public.yangon_training_reduction_progress set phase = 'complete', updated_at = now() where warehouse_id = p_warehouse_id;
    return jsonb_build_object('done', true, 'phase', 'complete', 'deleted', removed_count);
  end if;
  return jsonb_build_object('done', false, 'phase', current_phase, 'deleted', 0);
end;
$$;

revoke all on function public.delete_yangon_training_branch_chunk(uuid) from public, anon;
grant execute on function public.delete_yangon_training_branch_chunk(uuid) to authenticated;
