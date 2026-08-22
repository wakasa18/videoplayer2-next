-- ============================================================
-- Phase 5C: Assignment Automation, Reminders, Templates & Insights
-- Supabase / PostgreSQL
-- Run after assignments_complete_upgrade.sql and the corrected
-- phase5b_assignment_management.sql.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS recurrence_until DATE NULL,
  ADD COLUMN IF NOT EXISTS occurrence_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_from_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS recurrence_last_generated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reminder_due_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL;

DO $$ BEGIN
  ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_recurrence_v3_check
    CHECK (
      recurrence IS NULL OR recurrence IN
      ('daily','weekdays','weekly','biweekly','monthly')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_generated_from_fk
    FOREIGN KEY (generated_from_id)
    REFERENCES public.assignments(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.assignments
SET recurrence_series_id = gen_random_uuid()::text
WHERE recurrence IS NOT NULL
  AND recurrence_series_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_reminder_queue
  ON public.assignments(owner_id, reminder_sent_at, snoozed_until, due_date)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_recurrence_queue
  ON public.assignments(owner_id, recurrence, next_occurrence_id, completed_at)
  WHERE recurrence IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assignments_recurrence_occurrence
  ON public.assignments(owner_id, recurrence_series_id, occurrence_index)
  WHERE recurrence_series_id IS NOT NULL;

ALTER TABLE public.assignment_templates
  ADD COLUMN IF NOT EXISTS due_offset_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  ALTER TABLE public.assignment_templates
    ADD CONSTRAINT assignment_templates_due_offset_check
    CHECK (due_offset_days BETWEEN 0 AND 3650);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.assignment_notification_preferences (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  browser_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_address VARCHAR(320) NULL,
  daily_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  digest_time TIME NOT NULL DEFAULT '07:00',
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Manila',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assignment_notifications (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id INTEGER NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL DEFAULT 'reminder',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  dedupe_key VARCHAR(255) NOT NULL,
  read_at TIMESTAMPTZ NULL,
  emailed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assignment_notifications_event_check
    CHECK (event_type IN ('reminder','overdue','recurrence','digest','system')),
  CONSTRAINT assignment_notifications_owner_dedupe_unique
    UNIQUE(owner_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS public.assignment_automation_runs (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_source VARCHAR(20) NOT NULL DEFAULT 'cron',
  reminders_created INTEGER NOT NULL DEFAULT 0,
  recurrences_created INTEGER NOT NULL DEFAULT 0,
  emails_requested INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  CONSTRAINT assignment_automation_source_check
    CHECK (run_source IN ('cron','manual','completion'))
);

CREATE INDEX IF NOT EXISTS idx_assignment_notifications_owner_unread
  ON public.assignment_notifications(owner_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_notifications_assignment
  ON public.assignment_notifications(assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_automation_runs_owner
  ON public.assignment_automation_runs(owner_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_templates_owner_active
  ON public.assignment_templates(owner_id, is_archived, name);

ALTER TABLE public.assignment_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_automation_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.assignment_notification_preferences,
  public.assignment_notifications,
  public.assignment_automation_runs
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.assignment_notification_preferences,
  public.assignment_notifications
TO authenticated;

GRANT SELECT ON TABLE public.assignment_automation_runs TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE
  public.assignment_notifications_id_seq,
  public.assignment_automation_runs_id_seq
TO authenticated;

DROP POLICY IF EXISTS assignment_notification_preferences_owner_all
  ON public.assignment_notification_preferences;
CREATE POLICY assignment_notification_preferences_owner_all
  ON public.assignment_notification_preferences
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS assignment_notifications_owner_all
  ON public.assignment_notifications;
CREATE POLICY assignment_notifications_owner_all
  ON public.assignment_notifications
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS assignment_automation_runs_owner_select
  ON public.assignment_automation_runs;
CREATE POLICY assignment_automation_runs_owner_select
  ON public.assignment_automation_runs
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Give every existing user a default preference row.
INSERT INTO public.assignment_notification_preferences (owner_id)
SELECT id FROM auth.users
ON CONFLICT (owner_id) DO NOTHING;

COMMIT;

SELECT 'assignments_without_owner' AS check_name, COUNT(*)::BIGINT AS result
FROM public.assignments WHERE owner_id IS NULL
UNION ALL
SELECT 'templates_without_owner', COUNT(*)::BIGINT
FROM public.assignment_templates WHERE owner_id IS NULL
UNION ALL
SELECT 'preference_rows', COUNT(*)::BIGINT
FROM public.assignment_notification_preferences;
