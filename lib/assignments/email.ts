import "server-only";

import { randomUUID } from "node:crypto";
import tls from "node:tls";

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;
const EMAIL_TIMEOUT_MS = 15_000;

type EmailProvider = "gmail" | "webhook" | "none";

export type AssignmentEmailServiceStatus = {
  configured: boolean;
  provider: EmailProvider;
  sender: string | null;
};

export type AssignmentEmailResult = {
  ok: boolean;
  provider: EmailProvider;
  messageId: string | null;
  error: string | null;
};

type ReminderEmailInput = {
  email: string;
  assignmentId: number;
  title: string;
  message: string;
  dueAt: string | null;
  reminderAt?: string | null;
  description?: string | null;
  subject?: string | null;
  priority?: string | null;
  status?: string | null;
  ownerId: string;
  overdue: boolean;
};

type DigestAssignment = {
  id: number;
  title: string;
  dueAt: string | null;
  overdue: boolean;
};

type DigestEmailInput = {
  email: string;
  ownerId: string;
  dateKey: string;
  dueToday: DigestAssignment[];
  overdue: DigestAssignment[];
};

export function getAssignmentEmailServiceStatus(): AssignmentEmailServiceStatus {
  const gmailUser = getGmailUser();
  const gmailPassword = getGmailAppPassword();
  if (gmailUser && gmailPassword) {
    return {
      configured: true,
      provider: "gmail",
      sender: assignmentSender(gmailUser),
    };
  }

  const webhook = process.env.ASSIGNMENT_EMAIL_WEBHOOK_URL?.trim();
  if (webhook) {
    return { configured: true, provider: "webhook", sender: null };
  }

  return { configured: false, provider: "none", sender: null };
}

export async function sendAssignmentReminderEmail(
  input: ReminderEmailInput,
): Promise<AssignmentEmailResult> {
  const appUrl = appBaseUrl();
  const assignmentUrl = appUrl
    ? `${appUrl}/dashboard/assignments/${input.assignmentId}`
    : null;
  const assignmentsUrl = appUrl ? `${appUrl}/dashboard/assignments` : null;
  const dueLabel = input.dueAt ? formatDateTime(input.dueAt) : "No deadline set";
  const reminderLabel = input.reminderAt
    ? formatDateTime(input.reminderAt)
    : formatDateTime(new Date().toISOString());
  const timingLabel = input.dueAt
    ? relativeDeadlineLabel(input.dueAt)
    : "Scheduled reminder";
  const priorityLabel = formatPriority(input.priority);
  const statusLabel = formatStatus(input.status);
  const subject = input.overdue
    ? `Overdue: ${input.title}`
    : `Reminder: ${input.title}`;

  const text = [
    input.overdue ? "ASSIGNMENT OVERDUE" : "ASSIGNMENT REMINDER",
    input.title,
    input.message,
    input.subject ? `Subject: ${input.subject}` : null,
    `Deadline: ${dueLabel}`,
    `Timing: ${timingLabel}`,
    priorityLabel ? `Priority: ${priorityLabel}` : null,
    statusLabel ? `Status: ${statusLabel}` : null,
    input.description ? `Notes: ${truncateText(input.description, 500)}` : null,
    `Reminder scheduled: ${reminderLabel}`,
    assignmentUrl ? `Open assignment: ${assignmentUrl}` : null,
    assignmentsUrl ? `All assignments: ${assignmentsUrl}` : null,
    "Sent by Damon's Archive · Assignment Center",
  ]
    .filter(Boolean)
    .join("\n\n");

  return sendAssignmentEmail({
    to: input.email,
    subject,
    text,
    html: assignmentReminderHtml({
      title: input.title,
      message: input.message,
      dueLabel,
      timingLabel,
      reminderLabel,
      description: input.description ?? null,
      subject: input.subject ?? null,
      priority: priorityLabel,
      status: statusLabel,
      overdue: input.overdue,
      actionUrl: assignmentUrl,
      assignmentsUrl,
    }),
    webhookPayload: {
      type: "assignment_reminder",
      email: input.email,
      assignmentId: input.assignmentId,
      title: input.title,
      message: input.message,
      dueAt: input.dueAt,
      reminderAt: input.reminderAt ?? null,
      description: input.description ?? null,
      subject: input.subject ?? null,
      priority: input.priority ?? null,
      status: input.status ?? null,
      ownerId: input.ownerId,
      overdue: input.overdue,
      assignmentUrl,
    },
  });
}

export async function sendAssignmentDigestEmail(
  input: DigestEmailInput,
): Promise<AssignmentEmailResult> {
  const appUrl = appBaseUrl();
  const assignmentsUrl = appUrl ? `${appUrl}/dashboard/assignments` : null;
  const total = input.dueToday.length + input.overdue.length;
  const subject = `Assignment summary: ${input.dueToday.length} due today, ${input.overdue.length} overdue`;
  const rows = [...input.overdue, ...input.dueToday];

  const textRows = rows.length
    ? rows
        .map((assignment) => {
          const status = assignment.overdue ? "OVERDUE" : "DUE TODAY";
          const due = assignment.dueAt ? formatDateTime(assignment.dueAt) : "No time set";
          return `- [${status}] ${assignment.title} — ${due}`;
        })
        .join("\n")
    : "No assignments need attention.";

  const listHtml = rows
    .map((assignment) => {
      const status = assignment.overdue ? "Overdue" : "Due today";
      const due = assignment.dueAt ? formatDateTime(assignment.dueAt) : "No time set";
      const itemUrl = appUrl
        ? `${appUrl}/dashboard/assignments/${assignment.id}`
        : null;
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #1e293b;vertical-align:top">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${assignment.overdue ? "#fb7185" : "#22d3ee"}">${status}</div>
          <div style="margin-top:4px;font-size:15px;font-weight:700;color:#f8fafc">${escapeHtml(assignment.title)}</div>
          <div style="margin-top:4px;font-size:13px;color:#94a3b8">${escapeHtml(due)}</div>
        </td>
        <td style="padding:12px 0 12px 16px;border-bottom:1px solid #1e293b;text-align:right;vertical-align:middle">
          ${itemUrl ? `<a href="${escapeHtml(itemUrl)}" style="font-size:13px;font-weight:700;color:#67e8f9;text-decoration:none">Open</a>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  return sendAssignmentEmail({
    to: input.email,
    subject,
    text: [
      `Daily assignment summary for ${formatDateKey(input.dateKey)}.`,
      `${input.dueToday.length} due today · ${input.overdue.length} overdue · ${total} total`,
      textRows,
      assignmentsUrl ? `Open assignments: ${assignmentsUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: `<!doctype html><html><body style="margin:0;background:#020617;font-family:Arial,sans-serif;color:#e2e8f0"><div style="padding:32px 16px"><div style="max-width:640px;margin:0 auto;border:1px solid #1e293b;border-radius:24px;background:#08111f;overflow:hidden"><div style="padding:28px;background:linear-gradient(135deg,#0c4a6e,#172554)"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a5f3fc">Daily assignment summary</div><h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#f8fafc">${input.dueToday.length} due today · ${input.overdue.length} overdue</h1><p style="margin:10px 0 0;color:#cbd5e1">${escapeHtml(formatDateKey(input.dateKey))}</p></div><div style="padding:24px 28px"><table role="presentation" style="width:100%;border-collapse:collapse">${listHtml || `<tr><td style="padding:16px 0;color:#94a3b8">No assignments need attention.</td></tr>`}</table>${assignmentsUrl ? `<a href="${escapeHtml(assignmentsUrl)}" style="display:inline-block;margin-top:24px;padding:12px 18px;border-radius:999px;background:linear-gradient(135deg,#22d3ee,#4f46e5);color:#fff;font-size:14px;font-weight:700;text-decoration:none">Open assignments</a>` : ""}<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b">You received this because email reminders are enabled in Damon's Archive.</p></div></div></div></body></html>`,
    webhookPayload: {
      type: "assignment_digest",
      email: input.email,
      ownerId: input.ownerId,
      dateKey: input.dateKey,
      dueToday: input.dueToday,
      overdue: input.overdue,
      assignmentsUrl,
    },
  });
}

export async function sendAssignmentTestEmail(input: {
  email: string;
  ownerId: string;
}): Promise<AssignmentEmailResult> {
  const appUrl = appBaseUrl();
  const settingsUrl = appUrl ? `${appUrl}/dashboard/assignments/productivity` : null;
  return sendAssignmentEmail({
    to: input.email,
    subject: "Assignment email notifications are working",
    text: [
      "Your assignment email notifications are configured correctly.",
      "Scheduled assignment reminders and enabled daily summaries can now be sent to this address.",
      settingsUrl ? `Open reminder settings: ${settingsUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: assignmentReminderHtml({
      title: "Assignment notifications are ready",
      message: "Scheduled assignment reminders and enabled daily summaries can now be sent to this address.",
      dueLabel: "Gmail SMTP connected",
      timingLabel: "Email delivery ready",
      reminderLabel: formatDateTime(new Date().toISOString()),
      description: `Test recipient: ${input.email}`,
      subject: "Notification test",
      priority: "Normal",
      status: "Ready",
      overdue: false,
      actionUrl: settingsUrl,
      assignmentsUrl: settingsUrl,
    }),
    webhookPayload: {
      type: "assignment_test",
      email: input.email,
      ownerId: input.ownerId,
      settingsUrl,
    },
  });
}

async function sendAssignmentEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  webhookPayload: Record<string, unknown>;
}): Promise<AssignmentEmailResult> {
  const status = getAssignmentEmailServiceStatus();
  if (status.provider === "gmail") {
    return sendWithGmail(input, status.sender as string);
  }
  if (status.provider === "webhook") {
    return sendWithWebhook(input.webhookPayload);
  }
  return {
    ok: false,
    provider: "none",
    messageId: null,
    error:
      "Email delivery is not configured. Add GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD in Vercel.",
  };
}

async function sendWithGmail(
  input: { to: string; subject: string; text: string; html: string },
  sender: string,
): Promise<AssignmentEmailResult> {
  const gmailUser = getGmailUser();
  const gmailPassword = getGmailAppPassword();
  if (!gmailUser) {
    return {
      ok: false,
      provider: "gmail",
      messageId: null,
      error: "GMAIL_SMTP_USER is missing.",
    };
  }
  if (!gmailPassword) {
    return {
      ok: false,
      provider: "gmail",
      messageId: null,
      error: "GMAIL_SMTP_APP_PASSWORD is missing.",
    };
  }

  const messageId = `<${randomUUID()}@${gmailUser.split("@")[1] || "gmail.com"}>`;
  const message = buildMimeMessage({
    from: sender,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    messageId,
  });

  let socket: tls.TLSSocket | null = null;
  try {
    socket = await connectToGmail();
    const smtp = new SmtpSession(socket);

    expectSmtp(await smtp.nextResponse(), [220], "Gmail greeting");
    smtp.writeLine("EHLO damonarchive.local");
    expectSmtp(await smtp.nextResponse(), [250], "Gmail EHLO");

    smtp.writeLine("AUTH LOGIN");
    expectSmtp(await smtp.nextResponse(), [334], "Gmail authentication");
    smtp.writeLine(Buffer.from(gmailUser, "utf8").toString("base64"));
    expectSmtp(await smtp.nextResponse(), [334], "Gmail username");
    smtp.writeLine(Buffer.from(gmailPassword, "utf8").toString("base64"));
    expectSmtp(await smtp.nextResponse(), [235], "Gmail app password");

    smtp.writeLine(`MAIL FROM:<${smtpAddress(gmailUser)}>`);
    expectSmtp(await smtp.nextResponse(), [250], "Gmail sender");
    smtp.writeLine(`RCPT TO:<${smtpAddress(input.to)}>`);
    expectSmtp(await smtp.nextResponse(), [250, 251], "Gmail recipient");
    smtp.writeLine("DATA");
    expectSmtp(await smtp.nextResponse(), [354], "Gmail message data");
    smtp.writeMessage(message);
    expectSmtp(await smtp.nextResponse(), [250], "Gmail delivery");

    smtp.writeLine("QUIT");
    await smtp.nextResponse().catch(() => null);
    socket.end();

    return { ok: true, provider: "gmail", messageId, error: null };
  } catch (error) {
    socket?.destroy();
    return {
      ok: false,
      provider: "gmail",
      messageId: null,
      error: friendlyGmailError(error),
    };
  }
}

type SmtpResponse = {
  code: number;
  lines: string[];
};

class SmtpSession {
  private buffer = "";
  private responseLines: string[] = [];
  private responses: SmtpResponse[] = [];
  private waiters: Array<{
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  private failure: Error | null = null;

  constructor(private readonly socket: tls.TLSSocket) {
    socket.setEncoding("utf8");
    socket.setTimeout(EMAIL_TIMEOUT_MS);
    socket.on("data", (chunk) => this.consume(String(chunk)));
    socket.on("error", (error) => this.fail(error));
    socket.on("timeout", () => {
      const error = new Error("Gmail SMTP connection timed out.");
      this.fail(error);
      socket.destroy(error);
    });
    socket.on("close", () => {
      if (this.waiters.length > 0 && !this.failure) {
        this.fail(new Error("Gmail SMTP closed the connection unexpectedly."));
      }
    });
  }

  nextResponse(): Promise<SmtpResponse> {
    const response = this.responses.shift();
    if (response) return Promise.resolve(response);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  writeLine(line: string): void {
    this.socket.write(`${line}\r\n`);
  }

  writeMessage(message: string): void {
    this.socket.write(`${dotStuff(message)}\r\n.\r\n`);
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    while (true) {
      const lineEnd = this.buffer.indexOf("\n");
      if (lineEnd < 0) return;
      const line = this.buffer.slice(0, lineEnd).replace(/\r$/, "");
      this.buffer = this.buffer.slice(lineEnd + 1);
      this.responseLines.push(line);

      const match = /^(\d{3})([ -])/.exec(line);
      if (!match || match[2] === "-") continue;

      const response = {
        code: Number(match[1]),
        lines: this.responseLines,
      };
      this.responseLines = [];
      const waiter = this.waiters.shift();
      if (waiter) waiter.resolve(response);
      else this.responses.push(response);
    }
  }

  private fail(error: Error): void {
    if (this.failure) return;
    this.failure = error;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }
}

function connectToGmail(): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      servername: GMAIL_SMTP_HOST,
      rejectUnauthorized: true,
    });
    const timer = setTimeout(() => {
      const error = new Error("Gmail SMTP connection timed out.");
      socket.destroy(error);
      reject(error);
    }, EMAIL_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("error", handleError);
      socket.removeListener("secureConnect", handleConnect);
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const handleConnect = () => {
      cleanup();
      resolve(socket);
    };
    socket.once("error", handleError);
    socket.once("secureConnect", handleConnect);
  });
}

function expectSmtp(
  response: SmtpResponse,
  expectedCodes: number[],
  step: string,
): void {
  if (expectedCodes.includes(response.code)) return;
  throw new Error(`${step} failed: ${response.lines.join(" ")}`);
}

function buildMimeMessage(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string;
}): string {
  const boundary = `damonarchive-${randomUUID()}`;
  const lines = [
    `From: ${safeHeader(input.from)}`,
    `To: ${safeHeader(input.to)}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject, "utf8").toString("base64")}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${safeHeader(input.messageId)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.text, "utf8").toString("base64")),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.html, "utf8").toString("base64")),
    `--${boundary}--`,
  ];
  return lines.join("\r\n");
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function dotStuff(value: string): string {
  return value.replace(/(^|\r\n)\./g, "$1..");
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function smtpAddress(value: string): string {
  return value.replace(/[\r\n<>]/g, "").trim();
}

function getGmailUser(): string | null {
  return (
    process.env.GMAIL_SMTP_USER?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    null
  );
}

function getGmailAppPassword(): string | null {
  const value =
    process.env.GMAIL_SMTP_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  return value?.replace(/\s+/g, "") || null;
}

function assignmentSender(gmailUser: string): string {
  const configured = process.env.ASSIGNMENT_EMAIL_FROM?.trim();
  if (!configured) return `Damon's Archive <${gmailUser}>`;
  const configuredAddress = extractEmailAddress(configured);
  if (configuredAddress?.toLowerCase() !== gmailUser.toLowerCase()) {
    return `Damon's Archive <${gmailUser}>`;
  }
  return safeHeader(configured);
}

function extractEmailAddress(value: string): string | null {
  const bracketed = /<([^<>]+)>/.exec(value)?.[1]?.trim();
  const candidate = bracketed || value.trim();
  return /^\S+@\S+\.\S+$/.test(candidate) ? candidate : null;
}

function friendlyGmailError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Gmail SMTP request failed.";
  if (/535|534|username|password|authentication/i.test(message)) {
    return "Gmail rejected the sign-in. Confirm 2-Step Verification is enabled and use a 16-character Google App Password, not your normal Gmail password.";
  }
  if (/timed out|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH/i.test(message)) {
    return "The Gmail SMTP server could not be reached. Try again and check the Vercel function logs if the problem continues.";
  }
  return message;
}

async function sendWithWebhook(
  payload: Record<string, unknown>,
): Promise<AssignmentEmailResult> {
  const endpoint = process.env.ASSIGNMENT_EMAIL_WEBHOOK_URL?.trim();
  if (!endpoint) {
    return { ok: false, provider: "webhook", messageId: null, error: "Email webhook URL is missing." };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ASSIGNMENT_EMAIL_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.ASSIGNMENT_EMAIL_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        ok: false,
        provider: "webhook",
        messageId: null,
        error: `Email webhook returned HTTP ${response.status}.`,
      };
    }
    return { ok: true, provider: "webhook", messageId: null, error: null };
  } catch (error) {
    return {
      ok: false,
      provider: "webhook",
      messageId: null,
      error: error instanceof Error ? error.message : "Email webhook request failed.",
    };
  }
}

function assignmentReminderHtml(input: {
  title: string;
  message: string;
  dueLabel: string;
  timingLabel: string;
  reminderLabel: string;
  description: string | null;
  subject: string | null;
  priority: string | null;
  status: string | null;
  overdue: boolean;
  actionUrl: string | null;
  assignmentsUrl: string | null;
}): string {
  const accent = input.overdue ? "#fb7185" : "#22d3ee";
  const accentSoft = input.overdue ? "#3b1422" : "#083344";
  const eyebrow = input.overdue ? "Assignment overdue" : "Assignment reminder";
  const preheader = input.overdue
    ? `${input.title} has passed its deadline.`
    : `${input.title} — ${input.timingLabel}.`;
  const description = input.description?.trim()
    ? `<tr><td style="padding:0 28px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#0b1526;border:1px solid #1e2b3f;border-radius:16px"><tr><td style="padding:16px 18px"><div style="font-size:11px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#718096">Notes</div><div style="margin-top:8px;font-size:14px;line-height:1.65;color:#cbd5e1">${escapeHtmlMultiline(truncateText(input.description, 700))}</div></td></tr></table></td></tr>`
    : "";
  const subjectRow = input.subject
    ? detailCell("Subject", input.subject)
    : detailCell("Reminder", input.reminderLabel);
  const secondaryRow = input.subject
    ? detailCell("Reminder", input.reminderLabel)
    : "";

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#020617;border-collapse:collapse">
    <tr>
      <td align="center" style="padding:28px 12px">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;border-collapse:separate;border-spacing:0;background:#07111f;border:1px solid #1b2a3d;border-radius:24px;overflow:hidden">
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #172338;background:#081421">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                <tr>
                  <td style="vertical-align:middle">
                    <div style="font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#67e8f9">Damon's Archive</div>
                    <div style="margin-top:4px;font-size:13px;font-weight:700;color:#94a3b8">Assignment Center</div>
                  </td>
                  <td align="right" style="vertical-align:middle">
                    <span style="display:inline-block;padding:7px 11px;border:1px solid ${accent};border-radius:999px;background:${accentSoft};font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${accent}">${escapeHtml(eyebrow)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:4px;background:${accent};font-size:0;line-height:0">&nbsp;</td></tr>
          <tr>
            <td style="padding:30px 28px 18px">
              <div style="font-size:12px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;color:${accent}">${escapeHtml(input.timingLabel)}</div>
              <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;letter-spacing:-.02em;color:#f8fafc;font-weight:800">${escapeHtml(input.title)}</h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#aebed0">${escapeHtml(input.message)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 18px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#0c1728;border:1px solid #203148;border-radius:18px">
                <tr>
                  <td style="padding:18px 20px">
                    <div style="font-size:11px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;color:#718096">Deadline</div>
                    <div style="margin-top:7px;font-size:19px;line-height:1.4;font-weight:800;color:#f8fafc">${escapeHtml(input.dueLabel)}</div>
                    <div style="margin-top:6px;font-size:13px;font-weight:700;color:${accent}">${escapeHtml(input.timingLabel)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 18px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:10px 0;margin-left:-10px;width:calc(100% + 20px)">
                <tr>
                  ${subjectRow}
                  ${detailCell("Priority", input.priority || "Normal", input.priority === "High" ? "#fbbf24" : "#cbd5e1")}
                </tr>
              </table>
            </td>
          </tr>
          ${secondaryRow ? `<tr><td style="padding:0 28px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr>${secondaryRow}${detailCell("Status", input.status || "To do")}</tr></table></td></tr>` : `<tr><td style="padding:0 28px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr>${detailCell("Status", input.status || "To do")}</tr></table></td></tr>`}
          ${description}
          <tr>
            <td style="padding:2px 28px 28px">
              ${input.actionUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate"><tr><td bgcolor="#22d3ee" style="border-radius:12px;background:#22d3ee"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:13px 20px;font-size:14px;font-weight:800;color:#06202a;text-decoration:none">Open assignment</a></td></tr></table>` : ""}
              ${input.assignmentsUrl ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b">You can also <a href="${escapeHtml(input.assignmentsUrl)}" style="color:#67e8f9;text-decoration:none;font-weight:700">view all assignments</a> in your workspace.</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #172338;background:#050d18">
              <p style="margin:0;font-size:11px;line-height:1.65;color:#64748b">This automated reminder was sent because email reminders are enabled in Damon's Archive. Deadline and reminder times are shown in Philippine Time (PHT).</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailCell(label: string, value: string, valueColor = "#e2e8f0"): string {
  return `<td width="50%" style="padding:0 0 0 10px;vertical-align:top"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#091525;border:1px solid #1b2a3d;border-radius:14px"><tr><td style="padding:14px 15px"><div style="font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#64748b">${escapeHtml(label)}</div><div style="margin-top:6px;font-size:13px;line-height:1.5;font-weight:700;color:${valueColor}">${escapeHtml(value)}</div></td></tr></table></td>`;
}

function relativeDeadlineLabel(value: string): string {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "Scheduled reminder";
  const delta = due.getTime() - Date.now();
  if (Math.abs(delta) < 60_000) return "Due now";
  const duration = humanDuration(Math.abs(delta));
  return delta < 0 ? `Overdue by ${duration}` : `Due in ${duration}`;
}

function humanDuration(milliseconds: number): string {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days} day${days === 1 ? "" : "s"}`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function formatPriority(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return titleCase(value);
}

function formatStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const labels: Record<string, string> = {
    to_do: "To do",
    in_progress: "In progress",
    blocked: "Blocked",
    submitted: "Submitted",
    done: "Done",
  };
  return labels[value] ?? titleCase(value.replace(/_/g, " "));
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function appBaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return value || null;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date)} PHT`;
}

function formatDateKey(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 4));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full",
    timeZone: "Asia/Manila",
  }).format(date);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return replacements[character] ?? character;
  });
}

