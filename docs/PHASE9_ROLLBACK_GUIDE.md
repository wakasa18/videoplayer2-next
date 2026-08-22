# Phase 9 — Rollback Guide

Rollback is a controlled return to the last known working application and data state.

## Choose the rollback type

### Code-only rollback

Use when the new code is faulty but Phase 9 SQL is compatible and data remains correct.

1. In Vercel, open the last known working deployment.
2. Promote or redeploy it to Production.
3. Keep the same production environment variables.
4. Run `/api/health` and critical smoke tests.
5. Mark the Phase 9 release **Rolled Back**.

The Phase 9 tables are additive and can remain in the database during a code-only rollback.

### Application and data rollback

Use only when migration or cutover data is damaged.

1. Freeze both old and new applications.
2. Preserve a copy of the failed production state for investigation.
3. Restore the verified pre-cutover database backup using the Supabase recovery method available to the project.
4. Restore missing or overwritten Storage objects from the backup copy.
5. Redeploy the previous working application.
6. Re-run owner isolation, file access, and video playback checks.

Do not blindly delete Phase 9 tables while foreign keys or deployment records are still needed for investigation.

## Rollback verification

Confirm:

- login and logout work
- each user sees only their own data
- files preview and download
- public shares enforce their configured rules
- assignments load and save
- videos play and seek
- `/api/health` is healthy
- no unexplained missing Storage links remain

## After rollback

1. Record the reason in the release notes and event history.
2. Download the deployment report.
3. Identify the first failed smoke test or production error.
4. Fix the issue in a new release rather than editing the rolled-back release record.
5. Keep the old system read-only until a new cutover succeeds.
