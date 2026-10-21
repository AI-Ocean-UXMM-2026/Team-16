-- Correct the movement seed projection without rerunning the large network.
-- The failed chunk RPC was atomic, so its incomplete chunk was rolled back.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.seed_yangon_convenience_chunk(integer,integer,integer)'::regprocedure)
    into function_definition;

  if position('x.reason,x.created_at' in function_definition)>0 then
    function_definition := replace(function_definition,'x.reason,x.created_at','x.reason,auth.uid(),x.created_at');
  elsif position('x.reason,auth.uid(),x.created_at' in function_definition)=0 then
    raise exception 'Unexpected Yangon seed function body; refusing to rewrite it';
  end if;

  execute function_definition;
end;
$$;
