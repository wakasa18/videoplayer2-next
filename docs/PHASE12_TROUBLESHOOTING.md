# Troubleshooting Guide

## Website shows “Something went wrong”
Check Vercel Runtime Logs. Confirm Supabase URL, publishable key, and server secret are configured for Production, then redeploy.

## File preview refuses to connect
Confirm preview routes allow same-origin framing and that the current deployment contains the preview security-header exception.

## Video will not play
Check whether the object exists, the Storage path is correct, byte-range responses work, and the codec is browser-supported. MP4 does not guarantee H.264/AAC.

## Maintenance reports missing objects
Restore the original Storage object, reconnect the record, or delete the obsolete database record. Do not use stale-upload cleanup for active missing objects.

## Cron has not run
Confirm `CRON_SECRET`, the daily `/api/maintenance/daily` cron entry, and that the proxy does not redirect API requests to login.

## Build fails
Run `rm -rf .next`, `npm install`, `npm run check`, and `npm run build`. Fix the first TypeScript or build error before redeploying.
