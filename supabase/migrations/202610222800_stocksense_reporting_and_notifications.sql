-- Bounded, server-side movement aggregation for date-range reporting.
create or replace function public.get_warehouse_movement_range_summary(
  p_warehouse_id uuid,
  p_start_date date default null,
  p_end_date date default current_date
)
returns table(movement_day date, movement_type text, unit_total bigint, movement_count bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_end_date is null or p_end_date > (now() at time zone 'Asia/Yangon')::date then
    raise exception 'End date cannot be later than today';
  end if;
  if p_start_date is not null and p_start_date > p_end_date then
    raise exception 'Start date must be on or before end date';
  end if;
  if not (public.is_system_admin() or exists (
    select 1 from public.warehouse_members wm
    where wm.warehouse_id = p_warehouse_id and wm.user_id = auth.uid()
  )) then
    raise exception 'Warehouse access is required';
  end if;

  return query
  select (sm.created_at at time zone 'Asia/Yangon')::date,
         sm.movement_type::text,
         sum(sm.quantity)::bigint,
         count(*)::bigint
  from public.stock_movements sm
  where sm.warehouse_id = p_warehouse_id
    and (p_start_date is null or sm.created_at >= (p_start_date::timestamp at time zone 'Asia/Yangon'))
    and sm.created_at < ((p_end_date + 1)::timestamp at time zone 'Asia/Yangon')
  group by 1, 2
  order by 1, 2;
end;
$$;

revoke all on function public.get_warehouse_movement_range_summary(uuid,date,date) from public, anon;
grant execute on function public.get_warehouse_movement_range_summary(uuid,date,date) to authenticated;

create table if not exists public.user_notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (char_length(notification_id) between 1 and 240),
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.user_notification_reads enable row level security;
drop policy if exists "users read own notification states" on public.user_notification_reads;
create policy "users read own notification states" on public.user_notification_reads
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "users manage own notification states" on public.user_notification_reads;
create policy "users manage own notification states" on public.user_notification_reads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_notification_reads to authenticated;

create table if not exists public.inventory_sku_settings (
  singleton boolean primary key default true check (singleton),
  template text not null default '{DDDD}-{DD}-{SEQ:4}' check (char_length(template) between 3 and 80),
  next_sequence bigint not null default 1 check (next_sequence > 0),
  updated_at timestamptz not null default now()
);
insert into public.inventory_sku_settings(singleton) values (true) on conflict (singleton) do nothing;
alter table public.inventory_sku_settings enable row level security;
drop policy if exists "admins manage sku format" on public.inventory_sku_settings;
create policy "admins manage sku format" on public.inventory_sku_settings
  for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());
grant select, insert, update on public.inventory_sku_settings to authenticated;

create or replace function public.generate_product_sku(p_warehouse_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sku_template text;
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

  select template, next_sequence into sku_template, sequence_value
  from public.inventory_sku_settings where singleton = true for update;
  if sku_template is null or sku_template !~ '\{SEQ(:([0-9]+|N))?\}' then
    raise exception 'SKU format must include a sequence token';
  end if;
  loop
    width_value := coalesce(nullif((regexp_match(sku_template, '\{SEQ:([0-9]+)\}'))[1], '')::integer, 1);
    generated := replace(sku_template, '{DDDD}', to_char(current_date, 'YYYY'));
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
