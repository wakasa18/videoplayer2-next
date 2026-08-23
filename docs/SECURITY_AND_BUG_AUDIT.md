# Production bug and improvement audit

Audit date: 2026-08-23

## Fixed in this package

1. **Cron requests were redirected to login.** The global proxy matched `/api/maintenance/daily` and `/api/assignments/automation`, so unauthenticated Vercel cron requests could be redirected before bearer-secret validation. API requests now pass through to Route Handlers, which return their own JSON authentication responses.
2. **Email verification accepted an unsafe redirect target.** The `next` query parameter is now limited to same-site paths, and authentication failures no longer expose raw provider messages in the URL.
3. **Shared-folder ZIP downloads could use excessive memory and CPU.** ZIP creation now defaults to 25 files, 64 MB, and five archive requests per session per hour. These values are configurable through environment variables.
4. **Release archives could expose secrets.** `npm run package:clean` now creates a source-only folder that excludes `.env.local`, `.git`, `.next`, `.vercel`, `node_modules`, build caches, and key files.
5. **Supabase dependencies used `latest`.** The versions already present in the lockfile are now pinned in `package.json` for repeatable installs.

## Important action required

The reviewed ZIP contained `.env.local`, including server-only credentials and deployment tokens. Rotate the affected credentials before treating the project as secure:

- Supabase service-role or secret key
- `CRON_SECRET`
- `SHARE_TOKEN_ENCRYPTION_KEY`
- `SHARE_ANALYTICS_SALT`
- assignment webhook secret, when configured
- Vercel OIDC token or other temporary deployment credentials

After rotation, update Vercel Production variables and the local `.env.local`, then redeploy.

## Remaining improvements

- Add automated route and browser tests for login, file upload, sharing, video playback, cron authorization, and backup restore.
- Replace in-memory filtering of up to 5,000–10,000 database rows with database pagination and aggregate queries as data grows.
- Stream large shared-folder archives rather than buffering them; the new conservative limit is a safety control, not true streaming.
- Return generic production errors while logging database and Storage details privately.
- Add atomic database functions for file/video download counters to avoid lost increments during simultaneous downloads.
- Add automatic Recycle Bin retention only if the product should purge items after a defined period; current deletion remains manual.
