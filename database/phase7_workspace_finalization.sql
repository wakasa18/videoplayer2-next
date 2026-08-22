-- Phase 7: workspace settings, owner-safe activity history, storage summary,
-- account-security events, and final production hardening.
-- Run after Phases 1-6.

begin;

create table if not exists public.workspace_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(100),
  timezone varchar(80) not null default 'Asia/Manila',
  week_starts_on smallint not null default 1,
  default_module varchar(20) not null default 'home',
  compact_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_profiles_week_start_check
    check (week_starts_on between 0 and 6),
  constraint workspace_profiles_default_module_check
    check (default_module in ('home', 'files', 'assignments', 'videos', 'activity'))
);

alter table public.workspace_profiles
  add column if not exists display_name varchar(100),
  add column if not exists timezone varchar(80) not null default 'Asia/Manila',
  add column if not exists week_starts_on smallint not null default 1,
  add column if not exists default_module varchar(20) not null default 'home',
  add column if not exists compact_mode boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.workspace_security_events (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type varchar(80) not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_security_events_owner_created
  on public.workspace_security_events(owner_id, created_at desc);

-- Phase 3 audit rows originally did not consistently store an owner. Add one
-- so the final activity feed never depends on service-role access.
alter table public.important_file_audits
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

update public.important_file_audits audit
set owner_id = files.owner_id
from public.important_files files
where audit.owner_id is null
  and audit.file_id = files.id
  and files.owner_id is not null;

update public.important_file_audits
set owner_id = nullif(details ->> 'user_id', '')::uuid
where owner_id is null
  and coalesce(details ->> 'user_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- Assign unresolved legacy audit rows only when the project has exactly one user.
do $$
declare
  only_user uuid;
  user_count integer;
begin
  select count(*), min(id::text)::uuid into user_count, only_user from auth.users;
  if user_count = 1 then
    update public.important_file_audits
    set owner_id = only_user
    where owner_id is null;
  end if;
end $$;

create index if not exists idx_important_file_audits_owner_created
  on public.important_file_audits(owner_id, created_at desc);

-- Keep older file routes safe during a staged deployment. If an insert does not
-- explicitly include owner_id, derive it from the file, details.user_id, or the
-- current authenticated user before RLS evaluates the new row.
create or replace function public.phase7_fill_file_audit_owner()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  detail_user text;
begin
  if new.owner_id is null and new.file_id is not null then
    select files.owner_id
    into new.owner_id
    from public.important_files files
    where files.id = new.file_id;
  end if;

  if new.owner_id is null then
    detail_user := coalesce(new.details::jsonb ->> 'user_id', '');
    if detail_user ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      new.owner_id := detail_user::uuid;
    end if;
  end if;

  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;

  return new;
end;
$$;

revoke all on function public.phase7_fill_file_audit_owner() from public, anon, authenticated;
drop trigger if exists trg_phase7_fill_file_audit_owner on public.important_file_audits;
create trigger trg_phase7_fill_file_audit_owner
before insert on public.important_file_audits
for each row execute function public.phase7_fill_file_audit_owner();

do $$
begin
  if not exists (
    select 1 from public.important_file_audits where owner_id is null
  ) then
    alter table public.important_file_audits alter column owner_id set not null;
  end if;
end $$;

create or replace function public.phase7_touch_workspace_profile()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workspace_profiles_updated_at on public.workspace_profiles;
create trigger trg_workspace_profiles_updated_at
before update on public.workspace_profiles
for each row execute function public.phase7_touch_workspace_profile();

-- Automatically create a profile for future Auth users.
create or replace function public.phase7_create_workspace_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.workspace_profiles (owner_id, display_name)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), '')
  )
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_workspace_profile on auth.users;
create trigger on_auth_user_created_workspace_profile
after insert on auth.users
for each row execute function public.phase7_create_workspace_profile();

insert into public.workspace_profiles (owner_id, display_name)
select
  users.id,
  nullif(coalesce(users.raw_user_meta_data ->> 'display_name', split_part(users.email, '@', 1)), '')
from auth.users users
on conflict (owner_id) do nothing;

alter table public.workspace_profiles enable row level security;
alter table public.workspace_security_events enable row level security;
alter table public.important_file_audits enable row level security;

revoke all on public.workspace_profiles from anon;
revoke all on public.workspace_security_events from anon;
revoke all on public.important_file_audits from anon;

grant select, insert, update on public.workspace_profiles to authenticated;
grant select, insert on public.workspace_security_events to authenticated;
grant select, insert on public.important_file_audits to authenticated;
grant usage, select on sequence public.workspace_security_events_id_seq to authenticated;
do $$
begin
  if to_regclass('public.important_file_audits_id_seq') is not null then
    execute 'grant usage, select on sequence public.important_file_audits_id_seq to authenticated';
  end if;
end $$;

-- Replace only Phase 7 policy names; older policies may coexist safely.
drop policy if exists workspace_profiles_owner_select on public.workspace_profiles;
drop policy if exists workspace_profiles_owner_insert on public.workspace_profiles;
drop policy if exists workspace_profiles_owner_update on public.workspace_profiles;
create policy workspace_profiles_owner_select
  on public.workspace_profiles for select to authenticated
  using (owner_id = (select auth.uid()));
create policy workspace_profiles_owner_insert
  on public.workspace_profiles for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy workspace_profiles_owner_update
  on public.workspace_profiles for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists workspace_security_events_owner_select on public.workspace_security_events;
drop policy if exists workspace_security_events_owner_insert on public.workspace_security_events;
create policy workspace_security_events_owner_select
  on public.workspace_security_events for select to authenticated
  using (owner_id = (select auth.uid()));
create policy workspace_security_events_owner_insert
  on public.workspace_security_events for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists phase7_important_file_audits_owner_select on public.important_file_audits;
drop policy if exists phase7_important_file_audits_owner_insert on public.important_file_audits;
drop policy if exists phase7_important_file_audits_select_guard on public.important_file_audits;
drop policy if exists phase7_important_file_audits_insert_guard on public.important_file_audits;
create policy phase7_important_file_audits_owner_select
  on public.important_file_audits for select to authenticated
  using (owner_id = (select auth.uid()));
create policy phase7_important_file_audits_owner_insert
  on public.important_file_audits for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy phase7_important_file_audits_select_guard
  on public.important_file_audits as restrictive for select to authenticated
  using (owner_id = (select auth.uid()));
create policy phase7_important_file_audits_insert_guard
  on public.important_file_audits as restrictive for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- Owner-scoped workspace totals. Recycled objects remain included in byte usage
-- because they still consume Storage space until permanently deleted.
create or replace function public.get_workspace_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  current_owner uuid := auth.uid();
  file_bytes bigint := 0;
  video_bytes bigint := 0;
  result jsonb;
begin
  if current_owner is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(sum(file_size::bigint), 0)
  into file_bytes
  from public.important_files
  where owner_id = current_owner
    and status in ('active', 'deleted', 'pending', 'failed');

  select coalesce(sum(file_size::bigint), 0)
  into video_bytes
  from public.videos
  where owner_id = current_owner
    and status in ('active', 'deleted', 'pending', 'failed');

  select jsonb_build_object(
    'file_count', (
      select count(*) from public.important_files
      where owner_id = current_owner and status = 'active'
    ),
    'file_recycle_count', (
      select count(*) from public.important_files
      where owner_id = current_owner and status = 'deleted'
    ),
    'file_bytes', file_bytes,
    'video_count', (
      select count(*) from public.videos
      where owner_id = current_owner and status = 'active'
    ),
    'video_recycle_count', (
      select count(*) from public.videos
      where owner_id = current_owner and status = 'deleted'
    ),
    'video_bytes', video_bytes,
    'assignment_count', (
      select count(*) from public.assignments
      where owner_id = current_owner and deleted_at is null
    ),
    'active_share_count', (
      select count(*) from public.important_file_shares
      where owner_id = current_owner
        and revoked_at is null
        and (expires_at is null or expires_at > now())
    ),
    'total_bytes', file_bytes + video_bytes
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_workspace_summary() from public, anon;
grant execute on function public.get_workspace_summary() to authenticated;

-- Unified owner-safe activity feed across migrated modules.
create or replace function public.get_workspace_activity(
  p_module text default null,
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  activity_key text,
  module text,
  action text,
  target_id bigint,
  details jsonb,
  created_at timestamptz,
  total_count bigint
)
language sql
security invoker
stable
set search_path = public
as $$
  with all_events as (
    select
      'files:' || audit.id::text as activity_key,
      'files'::text as module,
      audit.action::text as action,
      audit.file_id::bigint as target_id,
      coalesce(audit.details::jsonb, '{}'::jsonb) as details,
      audit.created_at::timestamptz as created_at
    from public.important_file_audits audit
    where audit.owner_id = auth.uid()

    union all

    select
      'assignments:' || audit.id::text,
      'assignments'::text,
      audit.action::text,
      audit.assignment_id::bigint,
      coalesce(audit.details::jsonb, '{}'::jsonb),
      audit.created_at::timestamptz
    from public.assignment_audits audit
    where audit.owner_id = auth.uid()

    union all

    select
      'videos:' || audit.id::text,
      'videos'::text,
      audit.action::text,
      audit.video_id::bigint,
      coalesce(audit.details::jsonb, '{}'::jsonb),
      audit.created_at::timestamptz
    from public.video_audits audit
    where audit.owner_id = auth.uid()

    union all

    select
      'security:' || event.id::text,
      'security'::text,
      event.event_type::text,
      null::bigint,
      coalesce(event.details::jsonb, '{}'::jsonb),
      event.created_at::timestamptz
    from public.workspace_security_events event
    where event.owner_id = auth.uid()
  ), filtered as (
    select *
    from all_events
    where
      (nullif(trim(coalesce(p_module, '')), '') is null or module = trim(p_module))
      and (
        nullif(trim(coalesce(p_query, '')), '') is null
        or action ilike '%' || trim(p_query) || '%'
        or details::text ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.activity_key,
    filtered.module,
    filtered.action,
    filtered.target_id,
    filtered.details,
    filtered.created_at,
    count(*) over() as total_count
  from filtered
  order by filtered.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_workspace_activity(text, text, integer, integer)
  from public, anon;
grant execute on function public.get_workspace_activity(text, text, integer, integer)
  to authenticated;

commit;

select
  (select count(*) from public.workspace_profiles) as workspace_profiles,
  (select count(*) from public.important_file_audits where owner_id is null) as unresolved_file_audits;
