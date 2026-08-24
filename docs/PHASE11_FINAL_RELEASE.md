# Phase 11 Final Release and Sign-off

## Before deployment

1. Run `database/phase11_quality_assurance.sql` in Supabase.
2. Run `npm install`.
3. Run `npm run check`.
4. Run `npm run release:check`.
5. Run `npm run build`.
6. Test locally and complete the manual QA checklist.

## After deployment

Run:

```bash
HEALTH_CHECK_SECRET="your-secret" npm run smoke:production -- https://your-domain.com
```

Then open:

- `/dashboard/system`
- `/dashboard/maintenance`
- `/dashboard/quality`

Browse several production pages to collect Web Vitals, then run the QA suite again.

## Release decision

Release only when:

- there are no failed automated QA checks;
- critical Maintenance and System Check results are clear;
- the production smoke test passes;
- backup verification and restore rehearsal are complete;
- authentication, file, sharing, assignment, and video workflows pass on desktop and mobile;
- a rollback deployment is available.

## Rollback

If a release causes a critical issue, promote the previous successful Vercel deployment, restore the prior environment-variable set if changed, and avoid destructive database rollback unless the migration itself caused data corruption.
