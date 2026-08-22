-- ============================================================
-- Assignments Module Complete Upgrade (Supabase/PostgreSQL)
-- Run ONCE in Supabase SQL Editor on the existing deployed database.
-- ============================================================

BEGIN;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS subject_id BIGINT NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS recurrence_series_id VARCHAR(36) NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS next_occurrence_id INTEGER NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER NOT NULL DEFAULT 1440;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS custom_reminder_at TIMESTAMP NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS template_id BIGINT NULL;

UPDATE assignments SET status = 'to_do' WHERE status = 'pending';
UPDATE assignments SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL;

DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT assignments_status_v2_check
    CHECK (status IN ('to_do','in_progress','blocked','submitted','done'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT assignments_priority_v2_check
    CHECK (priority IN ('low','medium','high'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT assignments_reminder_minutes_check
    CHECK (reminder_minutes_before BETWEEN 0 AND 43200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS assignment_subjects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(30) NULL,
  instructor VARCHAR(100) NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#42E9FF',
  schedule VARCHAR(255) NULL,
  semester VARCHAR(100) NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL DEFAULT NOW(),
  CONSTRAINT assignment_subjects_color_check CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE IF NOT EXISTS assignment_templates (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  recurrence VARCHAR(20) NULL CHECK (recurrence IS NULL OR recurrence IN ('weekly','biweekly','monthly')),
  subject_id BIGINT NULL REFERENCES assignment_subjects(id) ON DELETE SET NULL,
  due_time VARCHAR(5) NULL,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 1440 CHECK (reminder_minutes_before BETWEEN 0 AND 43200),
  link_url VARCHAR(500) NULL,
  created_at TIMESTAMP NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_subtasks (
  id BIGSERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_notes (
  id BIGSERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_file_links (
  id BIGSERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  important_file_id INTEGER NOT NULL REFERENCES important_files(id) ON DELETE CASCADE,
  created_at TIMESTAMP NULL DEFAULT NOW(),
  CONSTRAINT assignment_file_links_unique UNIQUE (assignment_id, important_file_id)
);

DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT assignments_subject_id_fk
    FOREIGN KEY (subject_id) REFERENCES assignment_subjects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT assignments_template_id_fk
    FOREIGN KEY (template_id) REFERENCES assignment_templates(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT assignments_next_occurrence_fk
    FOREIGN KEY (next_occurrence_id) REFERENCES assignments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignments_queue_v2 ON assignments (deleted_at, archived_at, status, due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_subject_id ON assignments (subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_completed_at ON assignments (completed_at);
CREATE INDEX IF NOT EXISTS idx_assignments_recurrence_series ON assignments (recurrence_series_id);
CREATE INDEX IF NOT EXISTS idx_assignments_custom_reminder ON assignments (custom_reminder_at) WHERE custom_reminder_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_subjects_active ON assignment_subjects (is_archived, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_subjects_name_ci ON assignment_subjects (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_assignment_subtasks_assignment ON assignment_subtasks (assignment_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_assignment_notes_assignment ON assignment_notes (assignment_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_file_links_assignment ON assignment_file_links (assignment_id);

-- Import legacy subject text into managed subjects without changing current labels.
INSERT INTO assignment_subjects (name, color, created_at, updated_at)
SELECT DISTINCT ON (lower(trim(subject))) trim(subject), '#42E9FF', NOW(), NOW()
FROM assignments
WHERE subject IS NOT NULL AND trim(subject) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE assignments a
SET subject_id = s.id
FROM assignment_subjects s
WHERE a.subject_id IS NULL AND lower(trim(a.subject)) = lower(trim(s.name));

-- Preserve the old notes log as one structured note when no structured notes exist yet.
INSERT INTO assignment_notes (assignment_id, content, is_pinned, created_at, updated_at)
SELECT a.id, a.notes_log, FALSE, COALESCE(a.updated_at, NOW()), COALESCE(a.updated_at, NOW())
FROM assignments a
WHERE a.notes_log IS NOT NULL AND trim(a.notes_log) <> ''
  AND NOT EXISTS (SELECT 1 FROM assignment_notes n WHERE n.assignment_id = a.id);

INSERT INTO assignment_templates
(name, title, description, priority, reminder_minutes_before, created_at, updated_at)
VALUES
('Written Assignment', 'Written Assignment', 'Complete the written activity and review formatting before submission.', 'medium', 1440, NOW(), NOW()),
('Presentation', 'Presentation', 'Prepare slides, speaker notes, and rehearse the final presentation.', 'high', 1440, NOW(), NOW()),
('Quiz Review', 'Quiz Review', 'Review the lesson, summarize key ideas, and answer practice questions.', 'medium', 1440, NOW(), NOW()),
('Research Paper', 'Research Paper', 'Gather sources, draft the paper, review citations, and submit the final copy.', 'high', 1440, NOW(), NOW()),
('Capstone Deliverable', 'Capstone Deliverable', 'Complete the assigned capstone milestone and prepare supporting files.', 'high', 1440, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

ALTER TABLE assignment_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_file_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE assignment_subjects, assignment_templates, assignment_subtasks, assignment_notes, assignment_file_links FROM anon, authenticated;
REVOKE ALL ON SEQUENCE assignment_subjects_id_seq, assignment_templates_id_seq, assignment_subtasks_id_seq, assignment_notes_id_seq, assignment_file_links_id_seq FROM anon, authenticated;

COMMIT;
