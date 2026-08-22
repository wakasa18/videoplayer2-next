-- Phase 3B: ownership-safe file/folder management and Recycle Bin.
-- Run after phase3a_important_folders.sql in Supabase SQL Editor.

begin;

alter table public.important_files
  add column if not exists recycle_batch_id uuid;

alter table public.important_folders
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists status varchar(20) not null default 'active',
  add column if not exists deleted_at timestamp without time zone,
  add column if not exists recycle_batch_id uuid;

-- Backfill folder ownership from files stored in that folder tree when there is
-- only one distinct owner represented by the matching files.
with resolved as (
  select f.id, min(i.owner_id::text)::uuid as owner_id
  from public.important_folders f
  join public.important_files i
    on i.owner_id is not null
   and (
     i.folder_path = f.path
     or left(i.folder_path, length(f.path) + 1) = f.path || '/'
   )
  where f.owner_id is null
  group by f.id
  having count(distinct i.owner_id) = 1
)
update public.important_folders f
set owner_id = resolved.owner_id
from resolved
where f.id = resolved.id;

-- A personal installation usually has one Supabase Auth user. Assign any
-- remaining empty folders to that user automatically only when unambiguous.
do $$
declare
  only_user uuid;
  user_count integer;
begin
  select count(*), min(id::text)::uuid into user_count, only_user from auth.users;
  if user_count = 1 then
    update public.important_folders
    set owner_id = only_user
    where owner_id is null;
  end if;
end $$;

-- Replace the old globally unique path with an owner-scoped path.
drop index if exists public.uq_important_folders_path;
create unique index if not exists uq_important_folders_owner_path
  on public.important_folders (owner_id, path);

create index if not exists idx_important_folders_owner_status_parent
  on public.important_folders (owner_id, status, parent_path);
create index if not exists idx_important_folders_recycle_batch
  on public.important_folders (owner_id, recycle_batch_id)
  where recycle_batch_id is not null;
create index if not exists idx_important_files_owner_status_folder
  on public.important_files (owner_id, status, folder_path);
create index if not exists idx_important_files_recycle_batch
  on public.important_files (owner_id, recycle_batch_id)
  where recycle_batch_id is not null;

alter table public.important_folders enable row level security;

drop policy if exists "Authenticated users can read important folders" on public.important_folders;
drop policy if exists "Authenticated users can create important folders" on public.important_folders;
drop policy if exists "Authenticated users can update important folders" on public.important_folders;
drop policy if exists "Authenticated users can delete important folders" on public.important_folders;
drop policy if exists "Users can read their important folders" on public.important_folders;
drop policy if exists "Users can create their important folders" on public.important_folders;
drop policy if exists "Users can update their important folders" on public.important_folders;
drop policy if exists "Users can delete their important folders" on public.important_folders;

create policy "Users can read their important folders"
  on public.important_folders for select to authenticated
  using (owner_id = auth.uid());
create policy "Users can create their important folders"
  on public.important_folders for insert to authenticated
  with check (owner_id = auth.uid());
create policy "Users can update their important folders"
  on public.important_folders for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy "Users can delete their important folders"
  on public.important_folders for delete to authenticated
  using (owner_id = auth.uid());

-- Atomically rename or move a folder tree and all logical file locations.
create or replace function public.phase3b_move_important_folder(
  p_owner_id uuid,
  p_source_path text,
  p_destination_parent text,
  p_new_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := trim(both '/' from coalesce(p_source_path, ''));
  v_parent text := trim(both '/' from coalesce(p_destination_parent, ''));
  v_name text := btrim(coalesce(p_new_name, ''));
  v_destination text;
  v_folder_count integer;
  v_file_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'Not authorized';
  end if;
  if v_source = '' or v_name = '' or v_name in ('.', '..') or position('/' in v_name) > 0 or position('\\' in v_name) > 0 then
    raise exception 'Invalid folder name or path';
  end if;

  v_destination := case when v_parent = '' then v_name else v_parent || '/' || v_name end;
  if v_destination = v_source then
    return jsonb_build_object('path', v_destination, 'folders', 0, 'files', 0);
  end if;
  if left(v_destination, length(v_source) + 1) = v_source || '/' then
    raise exception 'A folder cannot be moved inside itself';
  end if;
  if not exists (
    select 1 from public.important_folders
    where owner_id = p_owner_id and path = v_source and status = 'active'
  ) then
    raise exception 'Folder not found';
  end if;
  if exists (
    select 1 from public.important_folders
    where owner_id = p_owner_id and path = v_destination and status = 'active'
  ) or exists (
    select 1 from public.important_files
    where owner_id = p_owner_id and folder_path = v_destination and status = 'active'
  ) then
    raise exception 'A folder with this name already exists in the destination';
  end if;

  update public.important_files
  set folder_path = case
        when folder_path = v_source then v_destination
        else v_destination || substring(folder_path from length(v_source) + 1)
      end,
      updated_at = now()
  where owner_id = p_owner_id
    and (folder_path = v_source or left(folder_path, length(v_source) + 1) = v_source || '/');
  get diagnostics v_file_count = row_count;

  update public.important_folders
  set path = case
        when path = v_source then v_destination
        else v_destination || substring(path from length(v_source) + 1)
      end,
      parent_path = case
        when path = v_source then nullif(v_parent, '')
        when parent_path = v_source then v_destination
        when parent_path is not null and left(parent_path, length(v_source) + 1) = v_source || '/'
          then v_destination || substring(parent_path from length(v_source) + 1)
        else parent_path
      end,
      name = case when path = v_source then v_name else name end,
      updated_at = now()
  where owner_id = p_owner_id
    and (path = v_source or left(path, length(v_source) + 1) = v_source || '/');
  get diagnostics v_folder_count = row_count;

  return jsonb_build_object('path', v_destination, 'folders', v_folder_count, 'files', v_file_count);
end;
$$;

-- Move an active folder tree and its active files into the Recycle Bin.
create or replace function public.phase3b_trash_important_folder(
  p_owner_id uuid,
  p_source_path text,
  p_batch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := trim(both '/' from coalesce(p_source_path, ''));
  v_folder_count integer;
  v_file_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'Not authorized';
  end if;
  if v_source = '' then raise exception 'Invalid folder path'; end if;
  if not exists (
    select 1 from public.important_folders
    where owner_id = p_owner_id and path = v_source and status = 'active'
  ) then raise exception 'Folder not found'; end if;

  update public.important_files
  set status = 'deleted', deleted_at = now(), purge_at = now() + interval '30 days',
      recycle_batch_id = p_batch_id, updated_at = now()
  where owner_id = p_owner_id and status = 'active'
    and (folder_path = v_source or left(folder_path, length(v_source) + 1) = v_source || '/');
  get diagnostics v_file_count = row_count;

  update public.important_folders
  set status = 'deleted', deleted_at = now(), recycle_batch_id = p_batch_id, updated_at = now()
  where owner_id = p_owner_id and status = 'active'
    and (path = v_source or left(path, length(v_source) + 1) = v_source || '/');
  get diagnostics v_folder_count = row_count;

  return jsonb_build_object('folders', v_folder_count, 'files', v_file_count, 'batch', p_batch_id);
end;
$$;

-- Restore only rows that were recycled together with the selected root folder.
create or replace function public.phase3b_restore_important_folder(
  p_owner_id uuid,
  p_source_path text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := trim(both '/' from coalesce(p_source_path, ''));
  v_batch uuid;
  v_folder_count integer;
  v_file_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'Not authorized';
  end if;
  select recycle_batch_id into v_batch
  from public.important_folders
  where owner_id = p_owner_id and path = v_source and status = 'deleted'
  limit 1;
  if v_batch is null then raise exception 'Recycled folder not found'; end if;

  update public.important_files
  set status = 'active', deleted_at = null, purge_at = null,
      recycle_batch_id = null, updated_at = now()
  where owner_id = p_owner_id and recycle_batch_id = v_batch and status = 'deleted';
  get diagnostics v_file_count = row_count;

  update public.important_folders
  set status = 'active', deleted_at = null, recycle_batch_id = null, updated_at = now()
  where owner_id = p_owner_id and recycle_batch_id = v_batch and status = 'deleted';
  get diagnostics v_folder_count = row_count;

  return jsonb_build_object('folders', v_folder_count, 'files', v_file_count);
end;
$$;

-- Permanently remove the selected deleted folder tree after Storage objects
-- have been moved to a temporary staging location by the server route.
create or replace function public.phase3b_delete_important_folder(
  p_owner_id uuid,
  p_source_path text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := trim(both '/' from coalesce(p_source_path, ''));
  v_folder_count integer;
  v_file_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'Not authorized';
  end if;
  if exists (
    select 1 from public.important_files where owner_id = p_owner_id and status = 'active'
      and (folder_path = v_source or left(folder_path, length(v_source) + 1) = v_source || '/')
  ) or exists (
    select 1 from public.important_folders where owner_id = p_owner_id and status = 'active'
      and (path = v_source or left(path, length(v_source) + 1) = v_source || '/')
  ) then raise exception 'Restore or recycle active items before permanent deletion'; end if;

  delete from public.important_files
  where owner_id = p_owner_id and status = 'deleted'
    and (folder_path = v_source or left(folder_path, length(v_source) + 1) = v_source || '/');
  get diagnostics v_file_count = row_count;

  delete from public.important_folders
  where owner_id = p_owner_id and status = 'deleted'
    and (path = v_source or left(path, length(v_source) + 1) = v_source || '/');
  get diagnostics v_folder_count = row_count;

  return jsonb_build_object('folders', v_folder_count, 'files', v_file_count);
end;
$$;

grant execute on function public.phase3b_move_important_folder(uuid,text,text,text) to authenticated, service_role;
grant execute on function public.phase3b_trash_important_folder(uuid,text,uuid) to authenticated, service_role;
grant execute on function public.phase3b_restore_important_folder(uuid,text) to authenticated, service_role;
grant execute on function public.phase3b_delete_important_folder(uuid,text) to authenticated, service_role;

commit;

-- Diagnostic: rows returned here need an owner assigned manually if your
-- project contains more than one Auth user and the folder had no files.
select id, path, name from public.important_folders where owner_id is null;
