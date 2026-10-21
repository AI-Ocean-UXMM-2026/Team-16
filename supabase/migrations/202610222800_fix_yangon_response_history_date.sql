-- Keep PL/pgSQL's history_start variable out of SQL column resolution in the
-- completed-chunk JSON response.
do $$
declare
  function_definition text;
  old_projection text := '''history_start'',history_start,''history_end'',current_date';
  fixed_projection text := '''history_start'',date ''2021-01-01'',''history_end'',current_date';
begin
  select pg_get_functiondef('public.seed_yangon_convenience_chunk(integer,integer,integer)'::regprocedure)
    into function_definition;

  if position(old_projection in function_definition)>0 then
    function_definition := replace(function_definition,old_projection,fixed_projection);
  elsif position(fixed_projection in function_definition)=0 then
    raise exception 'Unexpected Yangon seed response projection; refusing to rewrite it';
  end if;

  execute function_definition;
end;
$$;
