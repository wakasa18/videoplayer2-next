# Assignment email notifications with Gmail SMTP

The Assignments productivity page can send:

- due-soon reminder emails
- overdue assignment alerts
- daily assignment summaries
- a test email from the reminder settings panel

## 1. Create a Google App Password

Use the Gmail or Google Workspace account that will send the notifications. Enable **2-Step Verification** on that Google account, then create an App Password for the application. Google provides a 16-character password. Use that App Password only; do not use the account's normal password.

## 2. Configure Vercel

Add these server-only environment variables in Vercel:

```env
GMAIL_SMTP_USER=yourgmail@gmail.com
GMAIL_SMTP_APP_PASSWORD=your_16_character_app_password
ASSIGNMENT_EMAIL_FROM="Damon's Archive <yourgmail@gmail.com>"
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
CRON_SECRET=your-existing-random-cron-secret
```

`ASSIGNMENT_EMAIL_FROM` is optional. When it is omitted or contains a different address, the application safely uses `Damon's Archive <GMAIL_SMTP_USER>`.

Do not add `NEXT_PUBLIC_` to the Gmail username or App Password. Do not commit `.env.local`. After changing Vercel environment variables, redeploy Production.

## 3. Enable email reminders

Open:

```text
/dashboard/assignments/productivity
```

Turn on **Email reminders**, enter the recipient address, click **Send test email**, and save the reminder settings. Gmail can send the notification to an address different from the sender account.

## 4. Scheduled delivery

`vercel.json` runs assignment automation daily at `23:00 UTC`, which is `07:00` in the Philippines. The existing maintenance job runs at `00:00 UTC`.

The **Run reminders now** button can also process reminders immediately.

## 5. Gmail SMTP behavior

The application connects securely to `smtp.gmail.com` over TLS port `465`. Vercel Functions allow outbound SMTP connections except port 25. Gmail is suitable for personal or low-volume reminders, but Google may rate-limit or block unusual automated sending. Check Vercel function logs and the Gmail account's security activity when delivery fails.

## 6. Existing webhook compatibility

The previous webhook integration remains supported. When Gmail SMTP is not configured, the app uses:

```env
ASSIGNMENT_EMAIL_WEBHOOK_URL=https://your-webhook.example
ASSIGNMENT_EMAIL_WEBHOOK_SECRET=your-secret
```

Gmail SMTP takes priority when both integrations are configured.
