begin;

-- Phase 6: owner-safe private video library for Next.js + Supabase.

alter table public.videos
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists category varchar(100),
  add column if not exists is_favorite boolean not null default false,
  add column if not exists view_count bigint not null default 0,
  add column if not exists download_count bigint not null default 0,
  add column if not exists upload_token_hash text,
  add column if not exists finalized_at timestamptz,
  add column if not exists last_viewed_at timestamptz;

alter table public.videos
  alter column file_size type bigint using file_size::bigint;

alter table public.videos drop constraint if exists videos_status_check;
alter table public.videos
  add constraint videos_status_check
  check (status in ('pending', 'active', 'deleted', 'failed'));

alter table public.videos alter column status set default 'active';
alter table public.videos alter column is_favorite set default false;
alter table public.videos alter column view_count set default 0;
alter table public.videos alter column download_count set default 0;

-- Backfill owner_id automatically only when the Supabase project has one Auth user.
do $$
declare
  user_count bigint;
  only_user uuid;
begin
  select count(*) into user_count from auth.users;
  if user_count = 1 then
    select id into only_user from auth.users limit 1;
    update public.videos set owner_id = only_user where owner_id is null;
  end if;
end $$;

-- Require owner_id only when every legacy row has been assigned.
do $$
begin
  if not exists (select 1 from public.videos where owner_id is null) then
    alter table public.videos alter column owner_id set not null;
  end if;
end $$;

create index if not exists idx_videos_owner_status_created
  on public.videos(owner_id, status, created_at desc);
create index if not exists idx_videos_owner_favorite
  on public.videos(owner_id, is_favorite) where status = 'active';
create index if not exists idx_videos_owner_category
  on public.videos(owner_id, category) where status = 'active';
create unique index if not exists idx_videos_upload_token_hash
  on public.videos(upload_token_hash) where upload_token_hash is not null;

create table if not exists public.video_audits (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  video_id integer,
  action varchar(80) not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_video_audits_owner_created
  on public.video_audits(owner_id, created_at desc);
create index if not exists idx_video_audits_video
  on public.video_audits(video_id, created_at desc);

alter table public.videos enable row level security;
alter table public.video_audits enable row level security;

revoke all on public.videos from anon;
revoke all on public.video_audits from anon;
grant select, insert, update, delete on public.videos to authenticated;
grant select, insert on public.video_audits to authenticated;
grant usage, select on sequence public.videos_id_seq to authenticated;
grant usage, select on sequence public.video_audits_id_seq to authenticated;

drop policy if exists "Owners can read videos" on public.videos;
drop policy if exists "Owners can create videos" on public.videos;
drop policy if exists "Owners can update videos" on public.videos;
drop policy if exists "Owners can delete videos" on public.videos;

create policy "Owners can read videos"
  on public.videos for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Owners can create videos"
  on public.videos for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners can update videos"
  on public.videos for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners can delete videos"
  on public.videos for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Owners can read video audits" on public.video_audits;
drop policy if exists "Owners can create video audits" on public.video_audits;
create policy "Owners can read video audits"
  on public.video_audits for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Owners can create video audits"
  on public.video_audits for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- Create the private Storage bucket when it does not already exist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,
  2147483648,
  array['video/mp4','video/webm','video/quicktime','video/x-m4v','video/ogg','video/x-msvideo','video/x-matroska']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated fallback policies. The first folder in every object path is the owner UUID.
drop policy if exists "Owners can read video objects" on storage.objects;
drop policy if exists "Owners can upload video objects" on storage.objects;
drop policy if exists "Owners can update video objects" on storage.objects;
drop policy if exists "Owners can delete video objects" on storage.objects;

create policy "Owners can read video objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Owners can upload video objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Owners can update video objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Owners can delete video objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;

select 'videos' as table_name, count(*) as missing_owner
from public.videos
where owner_id is null;
