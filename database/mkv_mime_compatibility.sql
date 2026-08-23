-- MKV MIME compatibility hotfix
-- Some browsers report .mkv files as video/matroska while the original
-- bucket allowlist accepted only video/x-matroska. Keep both labels allowed.

update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/ogg',
  'video/x-msvideo',
  'video/x-matroska',
  'video/matroska'
]
where id = 'videos';

select id, name, allowed_mime_types
from storage.buckets
where id = 'videos';
