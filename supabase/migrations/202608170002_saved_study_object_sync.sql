-- ACCOUNT-002B-A: opt-in remote Saved Hand / Saved Spot persistence.
-- Authentication/profile data remains separate; no provider credential is stored here.

create table if not exists public.saved_study_objects (
  owner_auth_user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  object_id text not null,
  riverline_identity_id text not null,
  remote_schema_version text not null default 'remote-saved-study-object/v1',
  object_schema_version text not null,
  kind text not null,
  revision bigint not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz,
  object_data jsonb not null,
  last_operation_id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (owner_auth_user_id, object_id),
  constraint saved_study_object_id_length
    check (char_length(object_id) between 1 and 128),
  constraint saved_study_identity_length
    check (char_length(riverline_identity_id) between 1 and 240),
  constraint saved_study_remote_schema
    check (remote_schema_version = 'remote-saved-study-object/v1'),
  constraint saved_study_object_schema
    check (object_schema_version = 'saved-study-object/v1'),
  constraint saved_study_kind
    check (kind in ('hand', 'spot')),
  constraint saved_study_revision_positive
    check (revision > 0),
  constraint saved_study_timestamp_order
    check (updated_at >= created_at and (archived_at is null or archived_at = updated_at)),
  constraint saved_study_operation_id_length
    check (char_length(last_operation_id) between 1 and 240),
  constraint saved_study_document_object
    check (jsonb_typeof(object_data) = 'object'),
  constraint saved_study_document_identity
    check (
      object_data ->> 'schemaVersion' = remote_schema_version
      and object_data ->> 'objectSchemaVersion' = object_schema_version
      and object_data ->> 'id' = object_id
      and object_data ->> 'kind' = kind
      and (object_data ->> 'revision')::bigint = revision
      and (object_data ->> 'createdAt')::timestamptz = created_at
      and (object_data ->> 'updatedAt')::timestamptz = updated_at
      and (
        (object_data #>> '{lifecycle,archivedAt}' is null and archived_at is null)
        or (object_data #>> '{lifecycle,archivedAt}')::timestamptz = archived_at
      )
    )
);

create index if not exists saved_study_objects_pull_idx
  on public.saved_study_objects (owner_auth_user_id, riverline_identity_id, server_updated_at, object_id);

alter table public.saved_study_objects enable row level security;

revoke all on table public.saved_study_objects from public, anon, authenticated;
grant select on table public.saved_study_objects to authenticated;
grant insert (
  owner_auth_user_id, object_id, riverline_identity_id, remote_schema_version, object_schema_version,
  kind, revision, created_at, updated_at, archived_at, object_data, last_operation_id
) on table public.saved_study_objects to authenticated;
grant update (
  revision, updated_at, archived_at, object_data, last_operation_id
) on table public.saved_study_objects to authenticated;

drop policy if exists "saved_study_select_own" on public.saved_study_objects;
create policy "saved_study_select_own"
  on public.saved_study_objects for select
  to authenticated
  using (
    owner_auth_user_id = (select auth.uid())
    and riverline_identity_id = (
      select profiles.riverline_identity_id
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "saved_study_insert_own" on public.saved_study_objects;
create policy "saved_study_insert_own"
  on public.saved_study_objects for insert
  to authenticated
  with check (
    owner_auth_user_id = (select auth.uid())
    and riverline_identity_id = (
      select profiles.riverline_identity_id
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "saved_study_update_own" on public.saved_study_objects;
create policy "saved_study_update_own"
  on public.saved_study_objects for update
  to authenticated
  using (
    owner_auth_user_id = (select auth.uid())
    and riverline_identity_id = (
      select profiles.riverline_identity_id
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
    )
  )
  with check (
    owner_auth_user_id = (select auth.uid())
    and riverline_identity_id = (
      select profiles.riverline_identity_id
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
    )
  );

create or replace function public.guard_saved_study_object_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_auth_user_id <> old.owner_auth_user_id
    or new.object_id <> old.object_id
    or new.riverline_identity_id <> old.riverline_identity_id then
    raise exception 'saved study ownership and identity are immutable' using errcode = '22023';
  end if;
  if new.revision <= old.revision then
    raise exception 'saved study revision must advance' using errcode = '40001';
  end if;
  new.server_updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists saved_study_guard_revision on public.saved_study_objects;
create trigger saved_study_guard_revision
before update on public.saved_study_objects
for each row execute procedure public.guard_saved_study_object_revision();

create or replace function public.sync_saved_study_object_v1(
  p_operation_id text,
  p_riverline_identity_id text,
  p_expected_revision bigint,
  p_object jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  profile_identity text;
  current_row public.saved_study_objects%rowtype;
  stored_row public.saved_study_objects%rowtype;
  incoming_revision bigint;
  incoming_archived_at timestamptz;
  response_record jsonb;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select profiles.riverline_identity_id into profile_identity
  from public.profiles as profiles
  where profiles.auth_user_id = caller_id;
  if profile_identity is null or profile_identity <> p_riverline_identity_id then
    raise exception 'Riverline identity mismatch' using errcode = '42501';
  end if;
  if p_operation_id is null or char_length(p_operation_id) not between 1 and 240
    or p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_object) <> 'object'
    or p_object ->> 'schemaVersion' <> 'remote-saved-study-object/v1'
    or p_object ->> 'objectSchemaVersion' <> 'saved-study-object/v1'
    or coalesce(p_object ->> 'kind', '') not in ('hand', 'spot') then
    raise exception 'invalid Saved Study sync operation' using errcode = '22023';
  end if;
  incoming_revision := (p_object ->> 'revision')::bigint;
  incoming_archived_at := nullif(p_object #>> '{lifecycle,archivedAt}', '')::timestamptz;

  select * into current_row
  from public.saved_study_objects
  where owner_auth_user_id = caller_id
    and object_id = p_object ->> 'id'
  for update;

  if found and current_row.last_operation_id = p_operation_id then
    response_record := jsonb_build_object(
      'object', current_row.object_data,
      'serverUpdatedAt', current_row.server_updated_at,
      'operationId', current_row.last_operation_id
    );
    return jsonb_build_object('status', 'acknowledged', 'record', response_record);
  end if;

  if found and current_row.revision <> p_expected_revision then
    response_record := jsonb_build_object(
      'object', current_row.object_data,
      'serverUpdatedAt', current_row.server_updated_at,
      'operationId', current_row.last_operation_id
    );
    return jsonb_build_object('status', 'conflict', 'record', response_record);
  end if;
  if not found and p_expected_revision <> 0 then
    return jsonb_build_object('status', 'conflict', 'record', null);
  end if;
  if found and incoming_revision <= current_row.revision then
    raise exception 'incoming Saved Study revision must advance' using errcode = '40001';
  end if;

  insert into public.saved_study_objects (
    owner_auth_user_id, object_id, riverline_identity_id, remote_schema_version,
    object_schema_version, kind, revision, created_at, updated_at, archived_at,
    object_data, last_operation_id
  ) values (
    caller_id,
    p_object ->> 'id',
    p_riverline_identity_id,
    p_object ->> 'schemaVersion',
    p_object ->> 'objectSchemaVersion',
    p_object ->> 'kind',
    incoming_revision,
    (p_object ->> 'createdAt')::timestamptz,
    (p_object ->> 'updatedAt')::timestamptz,
    incoming_archived_at,
    p_object,
    p_operation_id
  )
  on conflict (owner_auth_user_id, object_id) do update set
    revision = excluded.revision,
    updated_at = excluded.updated_at,
    archived_at = excluded.archived_at,
    object_data = excluded.object_data,
    last_operation_id = excluded.last_operation_id
  returning * into stored_row;

  response_record := jsonb_build_object(
    'object', stored_row.object_data,
    'serverUpdatedAt', stored_row.server_updated_at,
    'operationId', stored_row.last_operation_id
  );
  return jsonb_build_object('status', 'acknowledged', 'record', response_record);
end;
$$;

create or replace function public.pull_saved_study_objects_v1(
  p_riverline_identity_id text,
  p_after_server_updated_at timestamptz default null,
  p_after_object_id text default null,
  p_limit integer default 100
)
returns table (object_data jsonb, server_updated_at timestamptz)
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 500 then
    raise exception 'invalid pull limit' using errcode = '22023';
  end if;
  if p_riverline_identity_id <> (
    select profiles.riverline_identity_id
    from public.profiles as profiles
    where profiles.auth_user_id = auth.uid()
  ) then
    raise exception 'Riverline identity mismatch' using errcode = '42501';
  end if;
  return query
  select objects.object_data, objects.server_updated_at
  from public.saved_study_objects as objects
  where objects.owner_auth_user_id = auth.uid()
    and objects.riverline_identity_id = p_riverline_identity_id
    and (
      p_after_server_updated_at is null
      or (objects.server_updated_at, objects.object_id)
        > (p_after_server_updated_at, coalesce(p_after_object_id, ''))
    )
  order by objects.server_updated_at, objects.object_id
  limit p_limit;
end;
$$;

revoke all on function public.sync_saved_study_object_v1(text, text, bigint, jsonb)
  from public, anon;
grant execute on function public.sync_saved_study_object_v1(text, text, bigint, jsonb)
  to authenticated;
revoke all on function public.pull_saved_study_objects_v1(text, timestamptz, text, integer)
  from public, anon;
grant execute on function public.pull_saved_study_objects_v1(text, timestamptz, text, integer)
  to authenticated;
