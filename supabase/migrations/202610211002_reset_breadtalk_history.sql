-- Replace only the three manifest-backed BreadTalk training branches. Real
-- warehouses and unmanifested catalogs are never targeted by this function.
create or replace function public.reset_breadtalk_history()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  demo_branch_count integer;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can reset historical demo data'; end if;

  select count(*) into demo_branch_count
  from public.demo_seed_runs r
  join public.warehouses w on w.id = r.warehouse_id
  where w.name in (
    'BreadTalk Demo — Central Kitchen',
    'BreadTalk Demo — Junction 8',
    'BreadTalk Demo — Airport Hub'
  );

  if demo_branch_count <> 3 then
    raise exception 'Expected exactly three manifest-backed BreadTalk demo branches; found %', demo_branch_count;
  end if;

  if exists (
    select 1 from public.warehouses w
    where w.name in (
      'BreadTalk Demo — Central Kitchen',
      'BreadTalk Demo — Junction 8',
      'BreadTalk Demo — Airport Hub'
    ) and not exists (
      select 1 from public.demo_seed_runs r where r.warehouse_id = w.id
    )
  ) then
    raise exception 'An unmanifested BreadTalk branch exists; no data was changed';
  end if;

  delete from public.warehouses w
  using public.demo_seed_runs r
  where r.warehouse_id = w.id
    and w.name in (
      'BreadTalk Demo — Central Kitchen',
      'BreadTalk Demo — Junction 8',
      'BreadTalk Demo — Airport Hub'
    );

  result := public.seed_breadtalk_history();
  return result;
end;
$$;

revoke all on function public.reset_breadtalk_history() from public;
grant execute on function public.reset_breadtalk_history() to authenticated;
