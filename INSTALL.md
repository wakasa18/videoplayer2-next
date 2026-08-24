# Phase 11 Hotfix Installation

1. Back up the current project and database.
2. Copy this package into the project root and replace matching files.
3. Keep the existing `.env.local`.
4. Run `database/phase11_quality_assurance.sql` in Supabase SQL Editor.
5. Run:

```bash
rm -rf .next
npm install
npm run check
npm run release:check
npm run build
npm run dev
```

6. Open `/dashboard/quality`, browse several dashboard pages to collect Web Vitals, and run the QA suite again.
7. Deploy and run:

```bash
HEALTH_CHECK_SECRET="your-secret" npm run smoke:production -- https://your-domain.com
```
