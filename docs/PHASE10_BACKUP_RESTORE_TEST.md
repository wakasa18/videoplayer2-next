# Phase 10 backup and restore test

The built-in export is a metadata backup. Storage objects and Supabase Auth secrets are not included.

## Verify a backup

1. Open `/dashboard/maintenance`.
2. Download a metadata backup.
3. Select **Verify a backup file** and choose the downloaded JSON.
4. Confirm the result is Pass or review each warning.
5. Store a copy outside Vercel and outside the Supabase project.

## Restore rehearsal

Use a separate Supabase test project. Apply database migrations in phase order, create the private Storage buckets, create a test account, and import only reviewed records with ownership IDs changed to the test account. Upload matching Storage objects separately. Never rehearse a restore directly against production.

## Recovery limitations

A metadata JSON file cannot recover deleted Storage objects, password hashes, authentication sessions, or environment-variable secrets. Use Supabase backups and an independent Storage copy for full disaster recovery.
