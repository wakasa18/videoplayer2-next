# Phase 11 Final QA Checklist

Complete this checklist after the automated Quality Assurance page shows no failed checks.

## Authentication and accounts

- Sign up with a new test email.
- Confirm the email redirect stays on the application domain.
- Log in, log out, request a password reset, and change the password.
- Confirm a signed-out visitor cannot open dashboard or owner API routes.

## Important Files

- Create nested folders and navigate breadcrumbs.
- Upload a small file and a file near the configured upload limit.
- Interrupt an upload and confirm retry or cleanup behavior.
- Preview supported files and download archives.
- Rename, move, favorite, recycle, restore, and permanently remove test files.
- Confirm another account cannot access the test file.

## Shared links

- Create file and folder links with preview-only and download access.
- Test expiration, password protection, maximum downloads, QR code, copy link, and ZIP download.
- Confirm unsupported preview types show a clear download-only message.
- Test desktop and mobile layouts.

## Assignments

- Create, edit, complete, archive, recycle, restore, and delete an assignment.
- Test subjects, subtasks, notes, file attachments, recurrence, and reminders.
- Confirm daily automation creates due reminders only once.

## Videos

- Upload MP4 and WebM test videos and verify playback, seeking, and download.
- Upload MKV and confirm storage succeeds while compatibility guidance is shown when needed.
- Interrupt a video upload and verify stale pending records are cleaned safely.
- Confirm missing-object repair does not alter unrelated metadata.

## Operations

- Run System Check, Maintenance, and Quality Assurance.
- Download and verify a metadata backup.
- Complete one restore rehearsal in a non-production project.
- Run the production smoke script.
- Confirm the previous successful Vercel deployment remains available for rollback.

## Accessibility and browsers

- Navigate the main workflows using only the keyboard.
- Confirm the skip link and focus indicator are visible.
- Test at 200% browser zoom.
- Test reduced-motion mode.
- Test current Chrome, Edge, Firefox, Android Chrome, and iPhone Safari.
