-- ============================================================
-- Phase 5B — Assignment Management (Supabase/PostgreSQL)
-- Adds ownership, CRUD support, archive/recycle security, and RLS.
-- Run once in Supabase SQL Editor after assignments_complete_upgrade.sql.
-- ============================================================

BEGIN;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER NOT NULL DEFAULT 1440,
  ADD COLUMN IF NOT EXISTS custom_reminder_at TIMESTAMPTZ NULL;

ALTER TABLE public.assignment_subjects
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_templates
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_subtasks
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_notes
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_file_links
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- Infer child ownership from the parent assignment whenever possible.
UPDATE public.assignment_subtasks child
SET owner_id = parent.owner_id
FROM public.assignments parent
WHERE child.assignment_id = parent.id
  AND child.owner_id IS NULL
  AND parent.owner_id IS NOT NULL;

UPDATE public.assignment_notes child
SET owner_id = parent.owner_id
FROM public.assignments parent
WHERE child.assignment_id = parent.id
  AND child.owner_id IS NULL
  AND parent.owner_id IS NOT NULL;

UPDATE public.assignment_file_links child
SET owner_id = parent.owner_id
FROM public.assignments parent
WHERE child.assignment_id = parent.id
  AND child.owner_id IS NULL
  AND parent.owner_id IS NOT NULL;

-- Infer subject ownership only when all assignments using the subject belong to one owner.
WITH resolved AS (
  SELECT a.subject_id, MIN(a.owner_id::TEXT)::UUID AS owner_id
  FROM public.assignments a
  WHERE a.subject_id IS NOT NULL AND a.owner_id IS NOT NULL
  GROUP BY a.subject_id
  HAVING COUNT(DISTINCT a.owner_id) = 1
)
UPDATE public.assignment_subjects subject
SET owner_id = resolved.owner_id
FROM resolved
WHERE subject.id = resolved.subject_id AND subject.owner_id IS NULL;

-- For the usual single-user deployment, safely assign remaining legacy rows.
DO $$
DECLARE
  only_user UUID;
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    SELECT id INTO only_user FROM auth.users LIMIT 1;
    UPDATE public.assignments SET owner_id = only_user WHERE owner_id IS NULL;
    UPDATE public.assignment_subjects SET owner_id = only_user WHERE owner_id IS NULL;
    UPDATE public.assignment_templates SET owner_id = only_user WHERE owner_id IS NULL;
    UPDATE public.assignment_subtasks SET owner_id = only_user WHERE owner_id IS NULL;
    UPDATE public.assignment_notes SET owner_id = only_user WHERE owner_id IS NULL;
    UPDATE public.assignment_file_links SET owner_id = only_user WHERE owner_id IS NULL;
  END IF;
END $$;

-- The old upgrade used global subject/template uniqueness. Replace it with owner-scoped uniqueness.
ALTER TABLE public.assignment_subjects DROP CONSTRAINT IF EXISTS assignment_subjects_name_key;
ALTER TABLE public.assignment_templates DROP CONSTRAINT IF EXISTS assignment_templates_name_key;
DROP INDEX IF EXISTS public.uq_assignment_subjects_name_ci;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_subjects_owner_name_ci
  ON public.assignment_subjects(owner_id, LOWER(name))
  WHERE owner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_templates_owner_name_ci
  ON public.assignment_templates(owner_id, LOWER(name))
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_owner_active
  ON public.assignments(owner_id, deleted_at, archived_at, status, due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_owner_archive
  ON public.assignments(owner_id, archived_at DESC)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_owner_recycle
  ON public.assignments(owner_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_subjects_owner_active
  ON public.assignment_subjects(owner_id, is_archived, name);
CREATE INDEX IF NOT EXISTS idx_assignment_subtasks_owner_assignment
  ON public.assignment_subtasks(owner_id, assignment_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_assignment_notes_owner_assignment
  ON public.assignment_notes(owner_id, assignment_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_file_links_owner_assignment
  ON public.assignment_file_links(owner_id, assignment_id);

CREATE TABLE IF NOT EXISTS public.assignment_audits (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id INTEGER NULL REFERENCES public.assignments(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_audits_owner_created
  ON public.assignment_audits(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_audits_assignment
  ON public.assignment_audits(assignment_id, created_at DESC);

-- Add/refresh owner-aware RLS.
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_file_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_audits ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.assignments,
  public.assignment_subjects,
  public.assignment_templates,
  public.assignment_subtasks,
  public.assignment_notes,
  public.assignment_file_links
TO authenticated;
GRANT SELECT ON TABLE public.assignment_audits TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE
  public.assignment_subjects_id_seq,
  public.assignment_templates_id_seq,
  public.assignment_subtasks_id_seq,
  public.assignment_notes_id_seq,
  public.assignment_file_links_id_seq,
  public.assignment_audits_id_seq
TO authenticated;

DROP POLICY IF EXISTS assignments_owner_select ON public.assignments;
DROP POLICY IF EXISTS assignments_owner_insert ON public.assignments;
DROP POLICY IF EXISTS assignments_owner_update ON public.assignments;
DROP POLICY IF EXISTS assignments_owner_delete ON public.assignments;
CREATE POLICY assignments_owner_select ON public.assignments FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY assignments_owner_insert ON public.assignments FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY assignments_owner_update ON public.assignments FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY assignments_owner_delete ON public.assignments FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS assignment_subjects_owner_all ON public.assignment_subjects;
CREATE POLICY assignment_subjects_owner_all ON public.assignment_subjects FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS assignment_templates_owner_all ON public.assignment_templates;
CREATE POLICY assignment_templates_owner_all ON public.assignment_templates FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS assignment_subtasks_owner_all ON public.assignment_subtasks;
CREATE POLICY assignment_subtasks_owner_all ON public.assignment_subtasks FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS assignment_notes_owner_all ON public.assignment_notes;
CREATE POLICY assignment_notes_owner_all ON public.assignment_notes FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS assignment_file_links_owner_all ON public.assignment_file_links;
CREATE POLICY assignment_file_links_owner_all ON public.assignment_file_links FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS assignment_audits_owner_select ON public.assignment_audits;
CREATE POLICY assignment_audits_owner_select ON public.assignment_audits FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- Enforce non-null ownership only when all legacy rows were resolved.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.assignments WHERE owner_id IS NULL) THEN
    ALTER TABLE public.assignments ALTER COLUMN owner_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assignment_subtasks WHERE owner_id IS NULL) THEN
    ALTER TABLE public.assignment_subtasks ALTER COLUMN owner_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assignment_notes WHERE owner_id IS NULL) THEN
    ALTER TABLE public.assignment_notes ALTER COLUMN owner_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assignment_file_links WHERE owner_id IS NULL) THEN
    ALTER TABLE public.assignment_file_links ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;

COMMIT;

-- Review these counts after the migration. In a single-user project all should be zero.
SELECT 'assignments' AS table_name, COUNT(*) AS missing_owner FROM public.assignments WHERE owner_id IS NULL
UNION ALL SELECT 'assignment_subjects', COUNT(*) FROM public.assignment_subjects WHERE owner_id IS NULL
UNION ALL SELECT 'assignment_templates', COUNT(*) FROM public.assignment_templates WHERE owner_id IS NULL
UNION ALL SELECT 'assignment_subtasks', COUNT(*) FROM public.assignment_subtasks WHERE owner_id IS NULL
UNION ALL SELECT 'assignment_notes', COUNT(*) FROM public.assignment_notes WHERE owner_id IS NULL
UNION ALL SELECT 'assignment_file_links', COUNT(*) FROM public.assignment_file_links WHERE owner_id IS NULL;
