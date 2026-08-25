# Damon’s Archive Administrator Guide

## Daily checks
Review `/dashboard/system`, `/dashboard/maintenance`, and `/dashboard/quality`. Investigate failed diagnostics, missing Storage objects, recent runtime errors, stale uploads, or old cron timestamps.

## Weekly checks
Download a metadata backup, verify it in Maintenance, review active shared links, inspect Storage usage, and confirm the latest Vercel deployment is healthy.

## Monthly checks
Review dependencies, rotate secrets when exposure is suspected, test a rollback, verify Supabase RLS and bucket privacy, and review the latest QA score and Web Vitals.

## User support
For upload failures, check file size, MIME type, Storage policies, and Vercel logs. For preview failures, inspect security headers, file format, signed URL creation, and browser codec support. For login failures, verify Supabase Site URL and Redirect URLs.

## Incident handling
1. Record the time, affected route, and user-visible message.
2. Check Vercel Runtime Logs and application error logs.
3. Reproduce locally when safe.
4. Roll back the deployment if the issue blocks core use.
5. Fix, validate, redeploy, and document the resolution.
