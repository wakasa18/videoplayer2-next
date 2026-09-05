-- Phase 13: selected workspace features
-- Adds recent file tracking, integrity hashes, share passwords, reminder delivery history,
-- login/session security, lockout controls, and restore audit support.
-- Run after Phase 12.

begin;

create extension if not exists pgcrypto;

-- Files: resumable-upload bookkeeping, exact duplicate hashes, integrity checks, recency.
alter table public.important_files
  add column if not exists upload_token_hash text,
  add column if not exists finalized_at timestamptz,
  add column if not exists checksum_sha256 text,
  add column if not exists checksum_verified_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists last_previewed_at timestamptz,
  add column if not exists last_downloaded_at timestamptz,
  add column if not exists replacement_of_id integer references public.important_files(id) on delete set null;

create unique index if not exists idx_important_files_upload_token_hash
  on public.important_files(upload_token_hash)
  where upload_token_hash is not null;
create index if not exists idx_important_files_owner_recent
  on public.important_files(owner_id, last_opened_at desc nulls last, updated_at desc)
  where status = 'active';
create index if not exists idx_important_files_owner_checksum
  on public.important_files(owner_id, checksum_sha256)
  where status = 'active' and checksum_sha256 is not null;

-- Share password protection. Passwords are scrypt-hashed by the Next.js server.
alter table public.important_file_shares
  add column if not exists password_hash text,
  add column if not exists password_salt text,
  add column if not exists password_hint varchar(120);

-- Reminder/email delivery history and retry diagnostics.
alter table public.assignment_notifications
  add column if not exists email_status varchar(20),
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_error text,
  add column if not exists email_last_attempt_at timestamptz;

update public.assignment_notifications
set email_status = case when emailed_at is not null then 'sent' else email_status end
where emailed_at is not null;

alter table public.assignment_notifications drop constraint if exists assignment_notifications_email_status_check;
alter table public.assignment_notifications
  add constraint assignment_notifications_email_status_check
  check (email_status is null or email_status in ('pending','sent','failed','retrying'));
create index if not exists idx_assignment_notifications_owner_email_history
  on public.assignment_notifications(owner_id, created_at desc, email_status);

-- Login protection and history. Email/IP are stored only as salted hashes.
create table if not exists public.workspace_login_attempts (
  bucket_key text primary key,
  email_hash char(64) not null,
  ip_hash char(64) not null,
  failure_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_login_attempts_failure_check check (failure_count >= 0)
);
create index if not exists idx_workspace_login_attempts_cleanup
  on public.workspace_login_attempts(updated_at);

alter table public.workspace_profiles
  add column if not exists login_email_hash char(64);

-- The application will populate hashes on successful sign-in. Existing users can
-- still sign in immediately; failed history begins being owner-linked after first success.

create table if not exists public.workspace_login_history (
  id bigserial primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  email_hash char(64) not null,
  ip_hash char(64) not null,
  status varchar(20) not null,
  reason varchar(160),
  user_agent text,
  device_label varchar(160),
  created_at timestamptz not null default now(),
  constraint workspace_login_history_status_check check (status in ('success','failed','locked','signed_out','revoked'))
);
create index if not exists idx_workspace_login_history_owner_created
  on public.workspace_login_history(owner_id, created_at desc);
create index if not exists idx_workspace_login_history_email_created
  on public.workspace_login_history(email_hash, created_at desc);

create table if not exists public.workspace_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ip_hash char(64) not null,
  user_agent text,
  device_label varchar(160),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason varchar(160)
);
create index if not exists idx_workspace_sessions_owner_seen
  on public.workspace_sessions(owner_id, last_seen_at desc);

-- Restore audit trail for metadata backups.
create table if not exists public.workspace_restore_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_filename varchar(255),
  backup_schema varchar(160),
  backup_version integer,
  mode varchar(20) not null default 'merge',
  status varchar(20) not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint workspace_restore_runs_mode_check check (mode in ('validate','merge')),
  constraint workspace_restore_runs_status_check check (status in ('running','pass','warn','fail'))
);
create index if not exists idx_workspace_restore_runs_owner_created
  on public.workspace_restore_runs(owner_id, created_at desc);

alter table public.workspace_login_history enable row level security;
alter table public.workspace_sessions enable row level security;
alter table public.workspace_restore_runs enable row level security;
alter table public.workspace_login_attempts enable row level security;

revoke all on public.workspace_login_attempts from anon, authenticated;
revoke all on public.workspace_login_history from anon;
revoke all on public.workspace_sessions from anon;
revoke all on public.workspace_restore_runs from anon;

grant select on public.workspace_login_history to authenticated;
grant select, update on public.workspace_sessions to authenticated;
grant select on public.workspace_restore_runs to authenticated;

drop policy if exists phase13_login_history_owner_select on public.workspace_login_history;
create policy phase13_login_history_owner_select on public.workspace_login_history
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists phase13_sessions_owner_select on public.workspace_sessions;
drop policy if exists phase13_sessions_owner_update on public.workspace_sessions;
create policy phase13_sessions_owner_select on public.workspace_sessions
  for select to authenticated using (owner_id = auth.uid());
create policy phase13_sessions_owner_update on public.workspace_sessions
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists phase13_restore_owner_select on public.workspace_restore_runs;
create policy phase13_restore_owner_select on public.workspace_restore_runs
  for select to authenticated using (owner_id = auth.uid());

-- Authenticated TUS/resumable uploads for the default files bucket. If your bucket
-- name is customized, duplicate these policies with that bucket_id.
drop policy if exists phase13_files_tus_insert on storage.objects;
drop policy if exists phase13_files_tus_update on storage.objects;
drop policy if exists phase13_files_tus_select on storage.objects;
create policy phase13_files_tus_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'important-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy phase13_files_tus_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'important-files'
    and owner_id = auth.uid()::text
  )
  with check (
    bucket_id = 'important-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy phase13_files_tus_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'important-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

select 'phase13_ready' as check_name,
  (select count(*) from public.workspace_sessions) as sessions,
  (select count(*) from public.workspace_login_history) as login_history,
  (select count(*) from public.workspace_restore_runs) as restores;
