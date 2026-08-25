# Backup and Restore Rehearsal

## Backup
1. Open Maintenance.
2. Download the metadata backup.
3. Verify the downloaded JSON file.
4. Store copies in at least two secure locations.
5. Export Supabase database and Storage separately when a full disaster-recovery backup is required.

## Restore rehearsal
1. Use a separate test Supabase project.
2. Apply database migrations in order.
3. Restore metadata using the documented import process or validated SQL/JSON tooling.
4. Restore Storage objects into the matching private buckets and paths.
5. Configure test environment variables.
6. Run System Check, Maintenance, QA, and smoke tests.
7. Record results without changing production.

A metadata backup alone does not contain the original file and video bytes. Database and Storage backups are both required for complete restoration.
