-- ============================================================
-- Phase 5D: Minute-level assignment reminder email scheduler
-- Supabase Cron + pg_net + Vault
--
-- PURPOSE
--   Calls the deployed Next.js assignment automation endpoint every minute.
--   The endpoint checks which reminders are due and sends enabled email
--   reminders through Gmail SMTP. Duplicate emails are prevented by the
--   assignment notification dedupe/emailed_at logic already in Phase 5C.
--
-- BEFORE RUNNING THIS FILE
--   1. Deploy the updated app to Vercel.
--   2. In Vercel, configure CRON_SECRET, SUPABASE_SECRET_KEY,
--      GMAIL_SMTP_USER, GMAIL_SMTP_APP_PASSWORD, NEXT_PUBLIC_APP_URL.
--   3. In Supabase Vault, create these TWO named secrets:
--        assignment_app_url      = https://YOUR-DEPLOYED-DOMAIN
--        assignment_cron_secret  = SAME VALUE AS VERCEL CRON_SECRET
--      Do not include a trailing slash in assignment_app_url.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Fail early when the required Vault values were not created yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'assignment_app_url'
      AND NULLIF(BTRIM(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Missing Vault secret: assignment_app_url';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'assignment_cron_secret'
      AND NULLIF(BTRIM(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Missing Vault secret: assignment_cron_secret';
  END IF;
END
$$;

-- Replace the previous job cleanly when this migration is re-run.
DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'assignment-email-reminders-every-minute'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'assignment-email-reminders-every-minute',
  '* * * * *',
  $cron$
    SELECT net.http_get(
      url := RTRIM(
        (SELECT decrypted_secret
         FROM vault.decrypted_secrets
         WHERE name = 'assignment_app_url'
         LIMIT 1),
        '/'
      ) || '/api/assignments/automation',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'assignment_cron_secret'
          LIMIT 1
        ),
        'Accept', 'application/json',
        'User-Agent', 'supabase-assignment-cron/1.0'
      ),
      timeout_milliseconds := 60000
    ) AS request_id;
  $cron$
);

COMMIT;

-- Verification: this should return one active job.
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'assignment-email-reminders-every-minute';
