# Phase 8 Rollback Guide

## Application rollback

1. In Vercel, open Deployments.
2. Select the last known-good deployment.
3. Promote it to Production.
4. Open `/api/health` and verify login, files, assignments, and videos.

The Phase 8 SQL migration is additive. Older Phase 7 application code can run while the `system_error_logs` table remains in the database.

## Database rollback

A database rollback is normally unnecessary. To remove only the Phase 8 logging feature after exporting its data:

```sql
drop function if exists public.purge_own_system_error_logs(integer);
drop table if exists public.system_error_logs;
```

Do not remove earlier phase tables when rolling back Phase 8.

## Incident steps

1. Disable the affected feature or promote the last good deployment.
2. Export metadata and preserve relevant error logs.
3. Record the deployment URL, commit, time, browser, and affected account.
4. Reproduce in Preview before publishing another Production deployment.
5. Rotate any secret that may have been exposed.
