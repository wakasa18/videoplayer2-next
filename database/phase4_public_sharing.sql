-- Phase 4: owner-safe public file and folder sharing
-- Run once in Supabase SQL Editor after Phase 3B.

BEGIN;

CREATE TABLE IF NOT EXISTS public.important_file_shares (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type VARCHAR(10) NOT NULL DEFAULT 'file',
  file_id INTEGER NULL REFERENCES public.important_files(id) ON DELETE CASCADE,
  folder_path VARCHAR(1000) NULL,
  token_hash CHAR(64) NOT NULL,
  token_ciphertext TEXT NULL,
  expires_at TIMESTAMPTZ NULL,
  max_downloads INTEGER NULL,
  allow_downloads BOOLEAN NOT NULL DEFAULT TRUE,
  share_title VARCHAR(255) NULL,
  share_message TEXT NULL,
  display_name VARCHAR(100) NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_by VARCHAR(100) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS share_type VARCHAR(10) NOT NULL DEFAULT 'file';
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS folder_path VARCHAR(1000) NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS token_ciphertext TEXT NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS allow_downloads BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS share_title VARCHAR(255) NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS share_message TEXT NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) NULL;
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.important_file_shares ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.important_file_shares ALTER COLUMN file_id DROP NOT NULL;

-- Backfill ownership for existing individual-file shares.
UPDATE public.important_file_shares AS shares
SET owner_id = files.owner_id
FROM public.important_files AS files
WHERE shares.owner_id IS NULL
  AND shares.file_id = files.id
  AND files.owner_id IS NOT NULL;

-- Best-effort ownership backfill for existing folder shares.
UPDATE public.important_file_shares AS shares
SET owner_id = (
  SELECT files.owner_id
  FROM public.important_files AS files
  WHERE files.owner_id IS NOT NULL
    AND (
      files.folder_path = shares.folder_path
      OR files.folder_path LIKE shares.folder_path || '/%'
    )
  ORDER BY files.id
  LIMIT 1
)
WHERE shares.owner_id IS NULL
  AND shares.share_type = 'folder';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'important_file_shares_type_check'
      AND conrelid = 'public.important_file_shares'::regclass
  ) THEN
    ALTER TABLE public.important_file_shares
      ADD CONSTRAINT important_file_shares_type_check
      CHECK (share_type IN ('file', 'folder'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'important_file_shares_target_check'
      AND conrelid = 'public.important_file_shares'::regclass
  ) THEN
    ALTER TABLE public.important_file_shares
      ADD CONSTRAINT important_file_shares_target_check CHECK (
        (share_type = 'file' AND file_id IS NOT NULL AND folder_path IS NULL)
        OR
        (share_type = 'folder' AND file_id IS NULL AND folder_path IS NOT NULL AND folder_path <> '')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'important_file_shares_max_downloads_check'
      AND conrelid = 'public.important_file_shares'::regclass
  ) THEN
    ALTER TABLE public.important_file_shares
      ADD CONSTRAINT important_file_shares_max_downloads_check
      CHECK (max_downloads IS NULL OR max_downloads BETWEEN 1 AND 100000);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_important_file_shares_token_hash
  ON public.important_file_shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_important_file_shares_owner_created
  ON public.important_file_shares(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_important_file_shares_file_id
  ON public.important_file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_important_file_shares_folder_path
  ON public.important_file_shares(owner_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_important_file_shares_active
  ON public.important_file_shares(owner_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS public.important_file_share_events (
  id BIGSERIAL PRIMARY KEY,
  share_id BIGINT NOT NULL REFERENCES public.important_file_shares(id) ON DELETE CASCADE,
  file_id INTEGER NULL REFERENCES public.important_files(id) ON DELETE SET NULL,
  event_type VARCHAR(60) NOT NULL,
  session_hash CHAR(64) NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_share_events_share_created
  ON public.important_file_share_events(share_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_events_type
  ON public.important_file_share_events(event_type);


CREATE OR REPLACE FUNCTION public.register_important_share_view(p_share_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.important_file_shares
  SET view_count = view_count + 1,
      last_accessed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_share_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_important_share_download(p_share_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.important_file_shares
  SET download_count = download_count + 1,
      last_accessed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_share_id
    AND revoked_at IS NULL
    AND allow_downloads = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_downloads IS NULL OR download_count < max_downloads);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.register_important_share_view(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_important_share_download(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_important_share_view(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_important_share_download(BIGINT) TO service_role;

ALTER TABLE public.important_file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.important_file_share_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.important_file_shares FROM anon, authenticated;
REVOKE ALL ON TABLE public.important_file_share_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.important_file_shares_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.important_file_share_events_id_seq FROM anon, authenticated;

COMMIT;

-- Review rows that could not be linked to an owner. They remain inaccessible
-- from the Next.js owner dashboard until owner_id is assigned manually.
SELECT id, share_type, file_id, folder_path, created_at
FROM public.important_file_shares
WHERE owner_id IS NULL
ORDER BY created_at DESC;
