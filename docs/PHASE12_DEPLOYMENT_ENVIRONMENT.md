# Deployment and Environment Reference

## Production platform
- Frontend and server routes: Vercel
- Authentication, database, and Storage: Supabase
- Production branch: `main`
- Production build: `npm run build`

## Required public variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Required server-only variables
- `SUPABASE_SECRET_KEY`
- `CRON_SECRET`
- `SHARE_TOKEN_ENCRYPTION_KEY`
- `SHARE_ANALYTICS_SALT`
- `VIDEO_REPAIR_TOKEN_SECRET`
- `HEALTH_CHECK_SECRET`

Never prefix server secrets with `NEXT_PUBLIC_`. Keep `.env.local` out of Git and release archives.

## Assignment email variables
To send assignment reminders through Gmail SMTP, add these server-only variables:

- `GMAIL_SMTP_USER` — the Gmail or Google Workspace account used to send
- `GMAIL_SMTP_APP_PASSWORD` — a 16-character Google App Password
- `ASSIGNMENT_EMAIL_FROM` — optional display name and the same Gmail address

Google 2-Step Verification must be enabled before an App Password can be created. Never use the normal Gmail password. The existing `ASSIGNMENT_EMAIL_WEBHOOK_URL` and `ASSIGNMENT_EMAIL_WEBHOOK_SECRET` variables remain available as a fallback integration.

## Deployment command
```bash
npm run check
npm run release:check
npm run build
git add .
git commit -m "Describe the release"
git push origin main
```
