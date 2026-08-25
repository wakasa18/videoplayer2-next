# Operational Handoff

## Ownership
Assign a named owner for production access, Vercel, Supabase, backups, incident response, dependency updates, and user support.

## Schedule
- Daily: automated cron, error review, service availability
- Weekly: backup verification, Storage usage, shared-link review
- Monthly: dependency/security audit, rollback test, access review
- Quarterly: restore rehearsal and full acceptance recheck

## Retention
Keep multiple verified backups. Retain error and maintenance history only as long as operationally useful. Revoke obsolete shared links and secrets.

## Completion criteria
The system is handed over when all required items in `/dashboard/handoff` pass and the authorized owner records final acceptance.
