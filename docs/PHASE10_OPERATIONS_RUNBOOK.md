# Phase 10 operations runbook

## Daily operation

The Vercel Hobby-compatible cron calls `/api/maintenance/daily` once each day. The route authenticates `CRON_SECRET`, processes assignment automation, removes stale pending uploads older than 24 hours, removes expired rate-limit buckets, applies the configured error-log retention period, and stores one maintenance report per workspace owner.

## Weekly review

1. Open `/dashboard/maintenance`.
2. Review storage quota, recent errors, missing-object samples, and timed checks.
3. Download the latest maintenance report.
4. Download a metadata backup and verify it from the same page.
5. Check Vercel Runtime Logs and Supabase database/storage usage.

## Safe cleanup

The cleanup action does not delete active files or active videos. It targets only database rows still marked `pending` after 24 hours, their matching temporary Storage paths, old error logs, and expired rate-limit counters.

## Incident response

1. Preserve the current Vercel deployment and download a metadata backup.
2. Review Runtime Logs and the System Check error table.
3. Roll back to the previous Ready deployment when the incident began after a release.
4. Do not run destructive SQL while investigating.
5. Record the incident and resolution in the deployment release notes.
