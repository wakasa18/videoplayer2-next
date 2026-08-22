# Damon’s Archive — Phase 8

A private Next.js and Supabase workspace for important files, public share links, assignments, productivity tools, and videos.

## Current release

Phase 8 adds production diagnostics, private error reporting, a health endpoint, Storage-link auditing, security headers, release validation, and deployment/rollback documentation.

## Setup

1. Copy `.env.example` to `.env.local` and set every required value.
2. Run the SQL files in `database/` in phase order, ending with `phase8_production_readiness.sql`.
3. Install and validate:

```bash
npm ci
npm run check
npm run release:check
npm run dev
```

Open `/dashboard/system` after signing in.

## Production

Read:

- `docs/PHASE8_DEPLOYMENT_GUIDE.md`
- `docs/PHASE8_TEST_CHECKLIST.md`
- `docs/PHASE8_ROLLBACK_GUIDE.md`

Server secrets must never be exposed through `NEXT_PUBLIC_` variables. Keep Row Level Security enabled for every exposed table and Storage policy.
