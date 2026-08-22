# Phase 8 Deployment Guide

## 1. Apply the database migration

Open Supabase SQL Editor and run:

```text
database/phase8_production_readiness.sql
```

Keep Row Level Security enabled. Never place a Supabase secret or legacy service-role key in a `NEXT_PUBLIC_` variable.

## 2. Configure production environment variables

Copy `.env.example` to `.env.local` for local development. In Vercel, add the same values under Project Settings → Environment Variables.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` or the legacy `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`
- `SHARE_TOKEN_ENCRYPTION_KEY`
- `SHARE_ANALYTICS_SALT`

Generate independent random values for every secret. Do not reuse a password.

## 3. Configure Supabase Auth URLs

In Supabase Authentication URL Configuration:

- Set Site URL to the production URL.
- Add the production callback URL.
- Add localhost callback URLs only for development.

## 4. Run local release checks

```bash
npm ci
npm run check
npm run release:check
npm run build
npm run start
```

Open:

- `/api/health`
- `/dashboard/system`
- `/dashboard/files`
- `/dashboard/assignments`
- `/dashboard/videos`

## 5. Deploy to Vercel

Import the repository as a Next.js project. Vercel reads `vercel.json` and schedules assignment automation hourly. When `CRON_SECRET` is configured, Vercel sends it to the cron route in the Authorization header.

After deployment, run the System Check page. Resolve every red result before client handover. Yellow results are warnings that require review.

## 6. Deep health check

Configure `HEALTH_CHECK_SECRET`, then call:

```bash
curl -H "Authorization: Bearer YOUR_HEALTH_CHECK_SECRET" \
  "https://YOUR_DOMAIN/api/health?deep=1"
```

The response verifies database access and the two configured Storage buckets without returning secret values.

## 7. Back up and release

Before each deployment:

1. Download the metadata backup from System Check.
2. Export the Supabase database from the Supabase dashboard or CLI.
3. Keep a copy of the previous working deployment.
4. Record the release date and commit SHA.

Do not treat the metadata JSON export as a complete Storage or database backup.
