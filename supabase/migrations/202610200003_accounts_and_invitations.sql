-- Account settings, roles, and secure warehouse invitations.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  locale text not null default 'en' check (locale in ('en', 'my')),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Existing managers bootstrap the Buildathon workspace as administrators. Future
-- administrator assignment remains controlled by the database owner.
insert into public.system_admins(user_id)
select distinct user_id from public.warehouse_members where role = 'manager'
on conflict do nothing;

create table if not exists public.warehouse_invitations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  role text not null check (role in ('manager', 'viewer')),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (warehouse_id, email)
);

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.system_admins where user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.system_admins enable row level security;
alter table public.warehouse_invitations enable row level security;

create policy "users manage own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own admin status" on public.system_admins for select to authenticated using (user_id = auth.uid());
create policy "admins manage invitations" on public.warehouse_invitations for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

create or replace function public.accept_warehouse_invitation(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  invitation public.warehouse_invitations;
  current_email text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into invitation from public.warehouse_invitations where token = p_token and accepted_at is null for update;
  if not found then raise exception 'This invitation is unavailable'; end if;
  if invitation.email <> current_email then raise exception 'Sign in with the invited email address'; end if;
  insert into public.warehouse_members(warehouse_id, user_id, role) values (invitation.warehouse_id, auth.uid(), invitation.role) on conflict (warehouse_id,user_id) do update set role = excluded.role;
  update public.warehouse_invitations set accepted_at = now() where id = invitation.id;
  return jsonb_build_object('warehouse_id', invitation.warehouse_id, 'role', invitation.role);
end;
$$;
revoke all on function public.accept_warehouse_invitation(uuid) from public;
grant execute on function public.accept_warehouse_invitation(uuid) to authenticated;
