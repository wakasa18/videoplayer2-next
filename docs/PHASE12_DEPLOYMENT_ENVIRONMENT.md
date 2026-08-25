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

## Deployment command
```bash
npm run check
npm run release:check
npm run build
git add .
git commit -m "Describe the release"
git push origin main
```
