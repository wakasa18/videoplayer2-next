# Phase 11 Performance and Security Guide

## Real-user performance

Phase 11 records authenticated dashboard Web Vitals for CLS, FCP, INP, LCP, and TTFB. The Quality Assurance page summarizes seven-day p75 values.

Recommended targets:

- CLS: 0.10 or lower
- FCP: 1.8 seconds or lower
- INP: 200 milliseconds or lower
- LCP: 2.5 seconds or lower
- TTFB: 800 milliseconds or lower

Investigate pages with repeated poor metrics before adding more animation or large client-side components.

## Large datasets

The current browser modules use bounded snapshots for several complex views. When any module approaches 5,000 active records, prioritize database-side pagination, search, sorting, and aggregate RPCs instead of increasing the snapshot limit.

## Security verification

- Keep Supabase secret keys server-only.
- Keep both Storage buckets private.
- Preserve owner filters and RLS policies.
- Keep public share routes token-scoped.
- Keep confirmation redirects restricted to internal paths.
- Keep the daily cron protected by `CRON_SECRET`.
- Rotate any secret that appears in a shared archive or screenshot.
- Run `npm audit --omit=dev` and review framework security advisories before each major release.

## Data retention

Quality history stores compact JSON results. Web Vitals should be periodically pruned if the table grows significantly. Maintenance and error-log retention should remain appropriate for the application's operating requirements.
