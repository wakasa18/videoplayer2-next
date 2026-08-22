# Phase 8 Final Test Checklist

## Authentication and security

- [ ] Login works on desktop and mobile.
- [ ] Logout removes access to dashboard routes.
- [ ] Password reset returns to the correct production URL.
- [ ] A user cannot read another owner's database rows or Storage objects.
- [ ] Service/secret keys are server-only and absent from browser bundles.
- [ ] `/api/health` exposes no secret values.

## Important Files

- [ ] Upload, preview, download, rename, move, recycle, restore, and permanent delete work.
- [ ] Folder actions work after refreshing the page.
- [ ] Public share links enforce their expiration and download settings.

## Assignments

- [ ] Create, edit, complete, archive, recycle, and restore work.
- [ ] Reminders and recurring assignments process manually.
- [ ] The Vercel cron endpoint returns 200 with a valid CRON_SECRET.

## Videos

- [ ] Upload and finalize a new H.264/AAC MP4.
- [ ] Playback starts and seeking produces HTTP 206 requests.
- [ ] Download works only when requested.
- [ ] Missing legacy objects show the repair workflow instead of a codec error.
- [ ] Recycle, restore, favorite, edit, and permanent delete work.

## Reliability

- [ ] `npm run check` passes.
- [ ] `npm run release:check` passes.
- [ ] `npm run build` passes.
- [ ] System Check contains no red results.
- [ ] A metadata backup downloads successfully.
- [ ] A forced UI error appears in the private error log.
- [ ] Mobile navigation, dialogs, and long tables remain usable.

## Deployment

- [ ] Production Site URL and redirect URLs are configured in Supabase Auth.
- [ ] Both Storage buckets exist and their policies are enabled.
- [ ] Vercel production environment variables are complete.
- [ ] Custom domain uses HTTPS.
- [ ] Previous release and rollback instructions are available.
