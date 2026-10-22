-- Keep the main warehouse and three central stores for a compact training network.
-- This is intentionally strict: abort instead of touching data if the manifest differs.
begin;

do $$
declare
  expected_names text[] := array[
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
  tracked_count integer;
  known_count integer;
  target_ids uuid[];
begin
  select count(*) into tracked_count from public.demo_seed_runs;
  select count(*) into known_count
  from public.demo_seed_runs r
  join public.warehouses w on w.id = r.warehouse_id
  where w.name = any(expected_names);

  if tracked_count <> 9 or known_count <> 9 then
    raise exception 'Yangon data cleanup stopped: expected exactly the nine tracked network branches. No rows were changed.';
  end if;

  if exists (
    select 1 from public.yangon_seed_progress p
    join public.warehouses w on w.id = p.warehouse_id
    where w.name = any(expected_names)
  ) then
    raise exception 'Yangon data cleanup stopped: a resumable seed load is in progress. Finish or reset it first.';
  end if;

  select array_agg(w.id) into target_ids
  from public.demo_seed_runs r
  join public.warehouses w on w.id = r.warehouse_id
  where w.name in (
    'Kamayut Convenience Store',
    'Thingangyun Convenience Store',
    'Hlaing Convenience Store',
    'Tamwe Convenience Store',
    'North Dagon Convenience Store'
  );
  if coalesce(array_length(target_ids, 1), 0) <> 5 then
    raise exception 'Yangon data cleanup stopped: the five selected branch records were not found.';
  end if;

  delete from public.yangon_branch_reset_progress where warehouse_id = any(target_ids);
  delete from public.yangon_seed_progress where warehouse_id = any(target_ids);
  delete from public.stock_movements where warehouse_id = any(target_ids);
  delete from public.products where warehouse_id = any(target_ids);
  delete from public.warehouse_members where warehouse_id = any(target_ids);
  delete from public.demo_seed_runs where warehouse_id = any(target_ids);
  delete from public.warehouses where id = any(target_ids);
end;
$$;

commit;
