-- DDDD is a stable alphanumeric branch prefix, not a calendar year.
create or replace function public.generate_product_sku(p_warehouse_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sku_template text;
  branch_name text;
  branch_code text;
  sequence_value bigint;
  generated text;
  width_value integer;
begin
  if not (public.is_system_admin() or exists (
    select 1 from public.warehouse_members wm
    where wm.warehouse_id = p_warehouse_id and wm.user_id = auth.uid() and wm.role in ('editor','manager')
  )) then
    raise exception 'Editor access is required to create a product';
  end if;
  select name into branch_name from public.warehouses where id = p_warehouse_id;
  if branch_name is null then raise exception 'Warehouse not found'; end if;
  branch_code := left(regexp_replace(upper(branch_name), '[^A-Z0-9]', '', 'g'), 4);
  branch_code := rpad(branch_code, 4, 'X');
  select template, next_sequence into sku_template, sequence_value
  from public.inventory_sku_settings where singleton = true for update;
  if sku_template is null or sku_template !~ '\{SEQ(:([0-9]+|N))?\}' then raise exception 'SKU format must include a sequence token'; end if;
  loop
    width_value := coalesce(nullif((regexp_match(sku_template, '\{SEQ:([0-9]+)\}'))[1], '')::integer, 1);
    generated := replace(sku_template, '{DDDD}', branch_code);
    generated := replace(generated, '{DD}', to_char(current_date, 'DD'));
    generated := replace(generated, '{MM}', to_char(current_date, 'MM'));
    generated := regexp_replace(generated, '\{SEQ(:([0-9]+|N))?\}', lpad(sequence_value::text, least(width_value, 12), '0'));
    update public.inventory_sku_settings set next_sequence = sequence_value + 1, updated_at = now() where singleton = true;
    exit when not exists (select 1 from public.products where warehouse_id = p_warehouse_id and sku = generated);
    sequence_value := sequence_value + 1;
  end loop;
  return generated;
end;
$$;
revoke all on function public.generate_product_sku(uuid) from public, anon;
grant execute on function public.generate_product_sku(uuid) to authenticated;
