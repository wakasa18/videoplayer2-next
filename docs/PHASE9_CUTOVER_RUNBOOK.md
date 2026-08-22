# Phase 9 — Production Cutover Runbook

This runbook minimizes data loss while moving users from the old system to the new Next.js application.

## Roles

Assign one person to each role, even if the same person performs multiple roles:

- **Cutover lead:** decides whether to continue or roll back.
- **Database operator:** runs SQL and verifies row counts.
- **Storage operator:** verifies files and videos.
- **Application tester:** completes the production smoke tests.
- **Communication owner:** tells users when the old system is frozen and when the new system is available.

## Before the cutover window

1. Confirm `npm run predeploy` passes.
2. Confirm Phase 9 SQL completed successfully.
3. Download a metadata backup from **System Check**.
4. Export or back up the database using the Supabase dashboard or CLI appropriate to the project plan.
5. Record current counts for:
   - users
   - important files
   - folders
   - active public shares
   - assignments
   - videos
6. Confirm both Storage buckets are private.
7. Confirm the previous working Vercel deployment is available for rollback.
8. Create the release in `/dashboard/deployment`.

## Cutover window

### 1. Freeze the old system

Prevent new uploads, edits, assignments, and deletions in the old application. A maintenance notice is safer than allowing two writable systems.

Record the exact freeze time in the release notes.

### 2. Capture the final delta

Export records and Storage objects created or modified after the previous migration checkpoint. Preserve owner IDs, file paths, timestamps, and status fields.

Do not overwrite a destination object unless its checksum or size confirms it is the intended replacement.

### 3. Apply the final delta

Import database changes first, then upload missing Storage objects to the exact paths referenced by the database.

Do not copy `.env` files, session cookies, service-role keys, or local build output.

### 4. Verify counts and links

Compare the old and new systems. Differences must be explained by deleted, archived, recycled, or intentionally excluded records.

Open **System Check** and confirm:

- no required table is missing
- both Storage buckets exist
- no sampled active file or video points to a missing object
- no new application errors are present

### 5. Test production

Complete every required test in `/dashboard/deployment`. Use small disposable files and videos, then clean them up after verification.

### 6. Switch users

Update bookmarks, shared documentation, and the custom domain. Keep the old system read-only until the monitoring window ends.

### 7. Mark the release live

Mark **Live** only after every required smoke test passes. Download the deployment report and store it with the release backup.

## Stop conditions

Stop and roll back when any of these occur:

- users cannot sign in
- owner isolation or RLS fails
- uploads succeed but records or Storage objects are missing
- downloads expose another user's data
- video playback is broadly broken
- the database migration corrupts or removes active records
- the production health endpoint remains degraded
- a required smoke test fails without a safe workaround

## Monitoring window

For at least the first day after launch:

- check `/api/health`
- review `/dashboard/system`
- review application errors
- verify the hourly assignment cron
- test one file download and one video playback
- watch Supabase database and Storage usage

Do not delete the old system or its backups during this window.
