-- ACCOUNT-002AR: remote account profile metadata only.
-- Poker study data remains local and is not written by this migration.

create table if not exists public.profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  riverline_identity_id text unique,
  username text not null,
  username_normalized text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_riverline_identity_id_length
    check (riverline_identity_id is null or char_length(riverline_identity_id) between 1 and 240),
  constraint profiles_username_normalized
    check (username = username_normalized and username = lower(username)),
  constraint profiles_username_format
    check (username ~ '^[a-z0-9][a-z0-9_]{2,23}$'),
  constraint profiles_username_reserved
    check (username not in (
      'admin', 'administrator', 'api', 'auth', 'guest', 'help', 'moderator',
      'riverline', 'root', 'security', 'staff', 'support', 'system'
    )),
  constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 80)
);

create unique index if not exists profiles_username_normalized_key
  on public.profiles (username_normalized);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (auth_user_id, username, username_normalized, display_name)
  on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

drop policy if exists "profiles_insert_own_unbound" on public.profiles;
create policy "profiles_insert_own_unbound"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = auth_user_id
    and riverline_identity_id is null
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_profile_updated_at();

create or replace function public.handle_new_riverline_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_username text := lower(new.raw_user_meta_data ->> 'username');
  requested_display_name text := btrim(new.raw_user_meta_data ->> 'display_name');
begin
  insert into public.profiles (
    auth_user_id,
    username,
    username_normalized,
    display_name
  ) values (
    new.id,
    requested_username,
    requested_username,
    requested_display_name
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_riverline_profile on auth.users;
create trigger on_auth_user_created_create_riverline_profile
after insert on auth.users
for each row execute procedure public.handle_new_riverline_user();

create or replace function public.bind_riverline_identity(p_riverline_identity_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_riverline_identity_id is null
    or char_length(p_riverline_identity_id) not between 1 and 240 then
    raise exception 'invalid Riverline identity' using errcode = '22023';
  end if;

  update public.profiles
  set riverline_identity_id = p_riverline_identity_id
  where auth_user_id = (select auth.uid())
    and (riverline_identity_id is null or riverline_identity_id = p_riverline_identity_id);
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Riverline identity binding conflict' using errcode = '23505';
  end if;
end;
$$;

revoke all on function public.bind_riverline_identity(text) from public, anon;
grant execute on function public.bind_riverline_identity(text) to authenticated;
