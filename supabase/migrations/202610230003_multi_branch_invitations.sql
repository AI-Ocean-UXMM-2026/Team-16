alter table public.user_provisioning_tokens add column if not exists warehouse_ids uuid[];
update public.user_provisioning_tokens set warehouse_ids = array[warehouse_id] where warehouse_ids is null;
alter table public.user_provisioning_tokens alter column warehouse_ids set not null;
alter table public.user_provisioning_tokens add constraint user_provisioning_tokens_warehouse_ids_nonempty check (cardinality(warehouse_ids) between 1 and 50);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  provision public.user_provisioning_tokens;
  assigned_role text;
  target_warehouse_id uuid;
begin
  if new.raw_user_meta_data ->> 'oceanblue_provisioning_token' is null then
    raise exception 'StockSense accounts must be created by a system administrator';
  end if;
  select * into provision from public.user_provisioning_tokens
    where token = (new.raw_user_meta_data ->> 'oceanblue_provisioning_token')::uuid
      and email = lower(new.email) and consumed_at is null and expires_at > now()
    for update;
  if not found then raise exception 'This administrator invitation is invalid or expired'; end if;
  if exists (select 1 from unnest(provision.warehouse_ids) assigned(id) left join public.warehouses w on w.id = assigned.id where w.id is null) then
    raise exception 'One or more invited branches are no longer available';
  end if;
  assigned_role := case when provision.app_role = 'viewer' then 'viewer' else 'editor' end;
  insert into public.profiles(id, full_name, username) values (new.id, provision.full_name, provision.username);
  foreach target_warehouse_id in array provision.warehouse_ids loop
    insert into public.warehouse_members(warehouse_id, user_id, role)
      values (target_warehouse_id, new.id, assigned_role);
  end loop;
  if provision.app_role = 'system_admin' then insert into public.system_admins(user_id) values (new.id); end if;
  update public.user_provisioning_tokens set consumed_at = now() where id = provision.id;
  return new;
end;
$$;
