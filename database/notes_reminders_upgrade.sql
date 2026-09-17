-- ============================================================
-- Notes + Reminders Module (Supabase/PostgreSQL)
-- Run ONCE in Supabase SQL Editor after phase13_selected_features.sql.
-- Adds personal notes with pin/archive/reminder support and connects
-- note reminders to the existing workspace notification feed.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_notes (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  color VARCHAR(20) NOT NULL DEFAULT 'violet',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_at TIMESTAMPTZ NULL,
  reminder_sent_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_notes_title_check CHECK (length(trim(title)) BETWEEN 1 AND 180),
  CONSTRAINT workspace_notes_content_check CHECK (length(content) <= 50000),
  CONSTRAINT workspace_notes_color_check CHECK (color IN ('violet','blue','emerald','amber','rose','slate'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_notes_owner_active
  ON public.workspace_notes(owner_id, is_pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_notes_owner_reminder
  ON public.workspace_notes(owner_id, reminder_at)
  WHERE reminder_at IS NOT NULL AND reminder_sent_at IS NULL AND archived_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_notes_owner_archive
  ON public.workspace_notes(owner_id, archived_at DESC)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.workspace_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_notes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.workspace_notes_id_seq TO authenticated;

DROP POLICY IF EXISTS workspace_notes_owner_all ON public.workspace_notes;
CREATE POLICY workspace_notes_owner_all
  ON public.workspace_notes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Reuse the existing workspace notification feed for note reminders.
ALTER TABLE public.assignment_notifications
  ADD COLUMN IF NOT EXISTS note_id BIGINT NULL REFERENCES public.workspace_notes(id) ON DELETE CASCADE;

ALTER TABLE public.assignment_notifications
  DROP CONSTRAINT IF EXISTS assignment_notifications_event_check;
ALTER TABLE public.assignment_notifications
  ADD CONSTRAINT assignment_notifications_event_check
  CHECK (event_type IN ('reminder','overdue','recurrence','digest','system','note_reminder'));

CREATE INDEX IF NOT EXISTS idx_assignment_notifications_note
  ON public.assignment_notifications(note_id, created_at DESC)
  WHERE note_id IS NOT NULL;

COMMIT;

SELECT 'workspace_notes' AS table_name, COUNT(*)::BIGINT AS row_count
FROM public.workspace_notes;
