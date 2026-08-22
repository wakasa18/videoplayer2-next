# Phase 9 — Production Smoke-Test Checklist

Use `/dashboard/deployment` as the official record. This document explains the expected result for each test.

## Pre-cutover

- **Metadata backup:** A JSON backup downloads and opens correctly.
- **Production build:** `npm run build` completes with exit code 0.
- **System Check:** No diagnostic is red.
- **Auth redirects:** Confirmation and password-reset links return to the production domain.
- **Private Storage:** The `important-files` and `videos` buckets are not public.

## Deployment

- **Public health:** `/api/health` returns HTTP 200 with `status: "ok"` and release `9.0.0`.
- **Deep health:** `/api/health?deep=1` returns HTTP 200 with database and Storage set to true when called with the health bearer secret.

## Authentication

- Sign in with a valid account.
- Refresh the page and confirm the session remains active.
- Sign out and confirm protected dashboard routes return to login.
- Request a password reset and confirm the link uses the production domain.

## Important Files

Using a disposable file:

1. Upload it.
2. Preview it without an automatic download.
3. Download it with the Download button.
4. Rename it.
5. Move it into a folder.
6. Move it to the Recycle Bin.
7. Restore it.
8. Permanently delete it.

Create a public share, open it in a private browser window, verify download permissions, and revoke it.

## Assignments

1. Create an assignment with a due date.
2. Edit it.
3. Add a note, subtask, and attachment.
4. Complete it.
5. Archive and restore it.
6. Run assignment automation and verify no authorization error appears.

## Videos

Use a small MP4 encoded with H.264 video and AAC audio:

1. Upload it.
2. Open the detail page.
3. Play and seek forward.
4. Download it.
5. Rename it.
6. Move it to the Recycle Bin, restore it, and delete it.

The terminal or network panel may show HTTP 206 for playback; this is expected for byte-range streaming.

## Workspace

- Change a harmless setting and reload the page.
- Confirm actions appear in Activity.
- Confirm the dashboard is usable at a mobile width.
- Repeat critical flows in a second current browser when possible.

## Cutover

- Resolve all missing active Storage objects.
- Freeze the old system before final data transfer.
- Compare final database and Storage counts.
- Confirm the previous Vercel deployment can be promoted or redeployed for rollback.
- Start post-launch health and error monitoring.
