-- Reapply the seed reset function with every cleanup scoped to manifest IDs.
-- This is intentionally forward-only for projects that already recorded the
-- original network-scale migration.
create or replace function public.prepare_yangon_convenience_reset()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tracked_count integer;
  known_count integer;
  old_count integer;
  yangon_count integer;
  progress_count integer;
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
  select count(*) into old_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id where w.name like 'BreadTalk%';
  select count(*) into yangon_count from public.demo_seed_runs r join public.warehouses w on w.id=r.warehouse_id where w.name in (
    'OceanBlue Main Warehouse','Yangon Downtown Convenience Store','Sanchaung Convenience Store','Bahan Convenience Store',
    'Kamayut Convenience Store','Thingangyun Convenience Store','Hlaing Convenience Store','Tamwe Convenience Store','North Dagon Convenience Store'
  );
  select count(*) into progress_count from public.yangon_seed_progress;
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
    select coalesce(array_agg(target.warehouse_id),array[]::uuid[]) into reset_ids from (
      select r.warehouse_id from public.demo_seed_runs r
      union select p.warehouse_id from public.yangon_seed_progress p
    ) target;
    delete from public.yangon_seed_progress where warehouse_id = any(reset_ids);
  end if;
  return jsonb_build_object(
    'warehouse_ids',reset_ids,
    'replaced',cardinality(reset_ids)>0,
    'resume_existing',progress_count>0 or yangon_count between 1 and 8
  );
end;
$$;

revoke all on function public.prepare_yangon_convenience_reset() from public,anon;
grant execute on function public.prepare_yangon_convenience_reset() to authenticated;
