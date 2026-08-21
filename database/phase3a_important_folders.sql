-- Phase 3A: explicit folders for the Next.js Important Files module.
-- Run this once in Supabase Dashboard -> SQL Editor.

begin;

create table if not exists public.important_folders (
  id bigserial primary key,
  path varchar(1000) not null,
  name varchar(255) not null,
  parent_path varchar(1000),
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint important_folders_path_not_blank check (btrim(path) <> ''),
  constraint important_folders_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists uq_important_folders_path
  on public.important_folders (path);

create index if not exists idx_important_folders_parent_path
  on public.important_folders (parent_path);

create index if not exists idx_important_files_folder_path
  on public.important_files (folder_path);

alter table public.important_folders enable row level security;

grant select, insert, update, delete
  on public.important_folders
  to authenticated;

grant usage, select
  on sequence public.important_folders_id_seq
  to authenticated;

drop policy if exists "Authenticated users can read important folders"
  on public.important_folders;
create policy "Authenticated users can read important folders"
  on public.important_folders
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create important folders"
  on public.important_folders;
create policy "Authenticated users can create important folders"
  on public.important_folders
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update important folders"
  on public.important_folders;
create policy "Authenticated users can update important folders"
  on public.important_folders
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete important folders"
  on public.important_folders;
create policy "Authenticated users can delete important folders"
  on public.important_folders
  for delete
  to authenticated
  using (true);

commit;
