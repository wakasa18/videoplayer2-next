# Phase 9 — Vercel Production Deployment

Use this guide after Phase 8 diagnostics pass locally.

## 1. Prepare the project

Run from the project root:

```bash
rm -rf .next
npm ci
npm run check
npm run release:check
npm run build
```

Do not deploy until all commands complete successfully.

## 2. Put the project in Git

Commit the Phase 9 source, SQL, and documentation. Do not commit `.env.local`, private keys, database passwords, or generated backups.

Recommended release commit:

```bash
git add .
git commit -m "Phase 9 production cutover"
git push origin main
```

## 3. Import the project into Vercel

1. Open the Vercel dashboard.
2. Create a new project and import the Git repository.
3. Keep **Framework Preset** set to Next.js.
4. Leave the root directory unchanged unless this application is inside a monorepo.
5. Use the default commands from `package.json`:
   - Install: `npm install` or `npm ci`
   - Build: `npm run build`
   - Output: detected automatically by Vercel

The project can also be deployed with Vercel CLI from the project root, but Git-based production deployments provide a clearer release and rollback history.

## 4. Add production environment variables

Add these to the **Production** environment in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
NEXT_PUBLIC_APP_URL=https://YOUR_PRODUCTION_DOMAIN

SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
SUPABASE_FILES_BUCKET=important-files
SUPABASE_VIDEOS_BUCKET=videos

CRON_SECRET=UNIQUE_RANDOM_SECRET
SHARE_TOKEN_ENCRYPTION_KEY=UNIQUE_RANDOM_SECRET
SHARE_ANALYTICS_SALT=UNIQUE_RANDOM_SECRET
VIDEO_REPAIR_TOKEN_SECRET=UNIQUE_RANDOM_SECRET
HEALTH_CHECK_SECRET=UNIQUE_RANDOM_SECRET

FILES_MAX_UPLOAD_BYTES=262144000
VIDEOS_MAX_UPLOAD_BYTES=2147483648
WORKSPACE_STORAGE_QUOTA_BYTES=10737418240
```

Use a different random value for every secret. Never create a `NEXT_PUBLIC_` version of a secret key.

For preview deployments, use the same Supabase project only if preview users are allowed to access production data. A separate Supabase project is safer for staging and destructive tests.

## 5. Run the Phase 9 SQL

In Supabase SQL Editor, run:

```text
database/phase9_production_cutover.sql
```

The script adds owner-scoped deployment releases, smoke tests, and event history. It does not change existing files, videos, assignments, or authentication users.

## 6. Configure Supabase authentication URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

- Set **Site URL** to the final production URL, such as `https://archive.example.com`.
- Add the exact production callback paths your application uses.
- Keep `http://localhost:3000/**` for local development.
- For Vercel previews, add `https://*-YOUR_TEAM_OR_ACCOUNT_SLUG.vercel.app/**` only when previews must support authentication.

Exact production redirect URLs are safer than broad wildcards.

## 7. Deploy and record the release

After Vercel finishes building:

1. Sign in locally or on the production domain.
2. Open `/dashboard/deployment`.
3. Create the Phase 9 release.
4. Enter the Vercel deployment URL and Git commit SHA.
5. Run automatic checks.
6. Mark the release **Ready**, then **Deploying**.
7. Complete the production smoke-test checklist.
8. Mark the release **Live** only after all required tests pass.

## 8. Verify cron authorization

`vercel.json` schedules `/api/assignments/automation` hourly. Vercel sends the value of `CRON_SECRET` as a bearer authorization header when that variable is configured in the project.

After deployment, run the assignment automation manually from **System Check** once, then verify the cron job appears in Vercel project settings.

## 9. Automated public smoke test

From your local project with production environment values available:

```bash
npm run smoke:production -- https://YOUR_PRODUCTION_DOMAIN
```

The script checks the home page, login page, public health endpoint, robots file, and the secret-protected deep health endpoint when `HEALTH_CHECK_SECRET` is available.

## Official references

- Vercel Next.js deployments: https://vercel.com/docs/frameworks/full-stack/nextjs
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel cron jobs: https://vercel.com/docs/cron-jobs
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
