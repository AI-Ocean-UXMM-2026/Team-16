-- Disambiguate the PL/pgSQL history_start variable from the manifest column.
do $$
declare
  function_definition text;
  old_projection text := 'select branch_id,auth.uid(),history_start,products_per_branch,';
  fixed_projection text := 'select branch_id,auth.uid(),date ''2021-01-01'',products_per_branch,';
begin
  select pg_get_functiondef('public.seed_yangon_convenience_chunk(integer,integer,integer)'::regprocedure)
    into function_definition;

  if position(old_projection in function_definition)>0 then
    function_definition := replace(function_definition,old_projection,fixed_projection);
  elsif position(fixed_projection in function_definition)=0 then
    raise exception 'Unexpected Yangon seed manifest projection; refusing to rewrite it';
  end if;

  execute function_definition;
end;
$$;
