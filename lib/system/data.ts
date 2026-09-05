import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getEnvironmentDiagnostics, getCanonicalAppUrl, hasServerAdminSecret } from "@/lib/system/env";
import { PHASE13_RELEASE } from "@/lib/system/release";
import type {
  DiagnosticStatus,
  StorageAuditSummary,
  SystemDiagnostic,
  SystemDiagnosticsData,
  SystemErrorLog,
} from "@/lib/system/types";
import { getFilesBucket, getVideosBucket } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveVideoObject, type VideoStorageRecord } from "@/lib/videos/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const EXPECTED_TABLES = [
  "workspace_profiles",
  "important_files",
  "important_file_audits",
  "assignments",
  "assignment_audits",
  "videos",
  "video_audits",
  "important_file_shares",
  "workspace_security_events",
  "system_error_logs",
  "deployment_releases",
  "deployment_smoke_tests",
  "deployment_events",
  "maintenance_runs",
  "backup_verifications",
  "quality_runs",
  "quality_web_vitals",
  "assignment_automation_runs",
  "workspace_sessions",
  "workspace_login_history",
  "workspace_restore_runs",
] as const;

export async function getSystemDiagnosticsData(): Promise<SystemDiagnosticsData> {
  const sessionClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser();
  if (userError || !user) redirect("/auth/login");

  const admin = createAdminClient();
  const client = admin ?? sessionClient;
  const environment = getEnvironmentDiagnostics();
  const checks: SystemDiagnostic[] = [];

  checks.push({
    id: "auth",
    label: "Authenticated session",
    status: "pass",
    summary: `Signed in as ${user.email ?? "current account"}.`,
  });

  const missingRequired = environment.filter((item) => item.required && !item.configured);
  checks.push({
    id: "environment",
    label: "Required environment variables",
    status: missingRequired.length ? "fail" : "pass",
    summary: missingRequired.length
      ? `${missingRequired.length} required production variable${missingRequired.length === 1 ? " is" : "s are"} missing.`
      : "All required production variables are configured.",
    detail: missingRequired.map((item) => item.key).join(", ") || null,
  });

  checks.push({
    id: "admin-secret",
    label: "Trusted server client",
    status: hasServerAdminSecret() ? "pass" : "warn",
    summary: hasServerAdminSecret()
      ? "A server-only Supabase secret is configured."
      : "No server secret is configured; maintenance and storage recovery use the signed-in session.",
  });

  const tableChecks = await Promise.all(
    EXPECTED_TABLES.map(async (table) => ({ table, ...(await checkTable(client, table)) })),
  );
  const missingTables = tableChecks.filter((item) => !item.ok);
  checks.push({
    id: "schema",
    label: "Database migration schema",
    status: missingTables.length ? "fail" : "pass",
    summary: missingTables.length
      ? `${missingTables.length} required table${missingTables.length === 1 ? " is" : "s are"} unavailable.`
      : `All ${EXPECTED_TABLES.length} required tables are reachable.`,
    detail: missingTables.map((item) => `${item.table}: ${item.message}`).join(" · ") || null,
  });

  const bucketCheck = await checkBuckets(client, Boolean(admin));
  checks.push(bucketCheck.diagnostic);

  const storageAudit = await auditStorage(client, user.id);
  const missingObjects = storageAudit.missingVideos + storageAudit.missingFiles;
  checks.push({
    id: "storage-links",
    label: "Database-to-Storage links",
    status: missingObjects ? "warn" : "pass",
    summary: missingObjects
      ? `${missingObjects} checked record${missingObjects === 1 ? " points" : "s point"} to a missing object.`
      : `Checked ${storageAudit.checkedVideos + storageAudit.checkedFiles} recent objects without finding broken links.`,
    detail: storageAudit.truncated
      ? "The audit samples the 25 most recent active files and videos."
      : null,
  });

  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const gmailConfigured = Boolean(process.env.GMAIL_SMTP_USER?.trim() && process.env.GMAIL_SMTP_APP_PASSWORD?.trim());
  checks.push({
    id: "smtp",
    label: "Gmail SMTP",
    status: gmailConfigured ? "pass" : "fail",
    summary: gmailConfigured
      ? "Gmail SMTP credentials are configured for assignment reminder delivery."
      : "GMAIL_SMTP_USER or GMAIL_SMTP_APP_PASSWORD is missing.",
  });

  const { data: latestCron } = await client
    .from("assignment_automation_runs")
    .select("started_at,finished_at,errors,emails_requested")
    .eq("run_source", "cron")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cronAgeMinutes = latestCron?.started_at ? Math.floor((Date.now() - new Date(String(latestCron.started_at)).getTime()) / 60_000) : null;
  checks.push({
    id: "automation",
    label: "Assignment reminder cron",
    status: !cronConfigured ? "fail" : cronAgeMinutes === null ? "warn" : cronAgeMinutes <= 5 ? "pass" : "warn",
    summary: !cronConfigured
      ? "CRON_SECRET is missing, so the secured reminder endpoint cannot run."
      : cronAgeMinutes === null
        ? "CRON_SECRET is configured, but no scheduled cron run is recorded yet."
        : cronAgeMinutes <= 5
          ? `Supabase Cron checked assignment reminders ${cronAgeMinutes < 1 ? "less than a minute" : `${cronAgeMinutes} minute${cronAgeMinutes === 1 ? "" : "s"}`} ago.`
          : `The latest assignment cron run was ${cronAgeMinutes} minutes ago. The expected schedule is every minute.`,
    detail: latestCron?.errors && Array.isArray(latestCron.errors) && latestCron.errors.length ? latestCron.errors.join(" · ") : null,
  });

  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count: failedEmailCount } = await client
    .from("assignment_notifications")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("email_status", "failed")
    .gte("created_at", since24h);
  checks.push({
    id: "email-delivery",
    label: "Reminder email delivery",
    status: Number(failedEmailCount ?? 0) > 0 ? "warn" : "pass",
    summary: Number(failedEmailCount ?? 0) > 0
      ? `${failedEmailCount} assignment email${failedEmailCount === 1 ? "" : "s"} failed in the last 24 hours.`
      : "No failed assignment reminder emails were recorded in the last 24 hours.",
  });

  const appUrl = getCanonicalAppUrl();
  checks.push({
    id: "canonical-url",
    label: "Canonical application URL",
    status: appUrl ? "pass" : "warn",
    summary: appUrl
      ? `Share links use ${appUrl}.`
      : "NEXT_PUBLIC_APP_URL is missing; preview deployments may generate unstable share links.",
  });

  const recentErrors = await getRecentErrors(client, user.id);
  checks.push({
    id: "recent-errors",
    label: "Recent application errors",
    status: recentErrors.length ? "warn" : "pass",
    summary: recentErrors.length
      ? `${recentErrors.length} recent error report${recentErrors.length === 1 ? " is" : "s are"} available for review.`
      : "No recent application error reports were found.",
  });

  return {
    release: PHASE13_RELEASE,
    checkedAt: new Date().toISOString(),
    overall: overallStatus(checks),
    deployment: {
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      region: process.env.VERCEL_REGION || process.env.AWS_REGION || null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null,
      appUrl,
      node: process.version,
    },
    environment,
    checks,
    storageAudit,
    recentErrors,
  };
}

async function checkTable(
  client: SupabaseClient,
  table: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await client.from(table).select("*", { head: true, count: "exact" }).limit(1);
  return error
    ? { ok: false, message: error.message }
    : { ok: true, message: "Available" };
}

async function checkBuckets(
  client: SupabaseClient,
  adminAvailable: boolean,
): Promise<{ diagnostic: SystemDiagnostic }> {
  const expected = [getFilesBucket(), getVideosBucket()];
  if (!adminAvailable) {
    return {
      diagnostic: {
        id: "buckets",
        label: "Storage buckets",
        status: "warn",
        summary: `Expected buckets: ${expected.join(", ")}. Add a server secret to verify bucket configuration directly.`,
      },
    };
  }

  const { data, error } = await client.storage.listBuckets();
  if (error) {
    return {
      diagnostic: {
        id: "buckets",
        label: "Storage buckets",
        status: "fail",
        summary: "Storage buckets could not be listed.",
        detail: error.message,
      },
    };
  }
  const names = new Set((data ?? []).map((bucket) => bucket.name));
  const missing = expected.filter((name) => !names.has(name));
  return {
    diagnostic: {
      id: "buckets",
      label: "Storage buckets",
      status: missing.length ? "fail" : "pass",
      summary: missing.length
        ? `Missing bucket${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`
        : `Both required buckets are available: ${expected.join(" and ")}.`,
    },
  };
}

async function auditStorage(
  client: SupabaseClient,
  ownerId: string,
): Promise<StorageAuditSummary> {
  const summary: StorageAuditSummary = {
    checkedVideos: 0,
    missingVideos: 0,
    recoveredVideos: 0,
    checkedFiles: 0,
    missingFiles: 0,
    truncated: false,
  };

  const [videoResult, fileResult] = await Promise.all([
    client
      .from("videos")
      .select("id,owner_id,file_path,filename,original_filename,created_at")
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(11),
    client
      .from("important_files")
      .select("id,file_path,original_filename")
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(16),
  ]);

  const videos = ((videoResult.data ?? []) as VideoStorageRecord[]).slice(0, 10);
  const files = ((fileResult.data ?? []) as Array<{
    id: number;
    file_path: string | null;
    original_filename: string | null;
  }>).slice(0, 15);
  summary.truncated = (videoResult.data?.length ?? 0) > 10 || (fileResult.data?.length ?? 0) > 15;

  for (const group of chunk(videos, 4)) {
    const results = await Promise.all(
      group.map((video) => resolveVideoObject(client, video, ownerId)),
    );
    summary.checkedVideos += results.length;
    for (const result of results) {
      if (!result) summary.missingVideos += 1;
      else if (result.recovered) summary.recoveredVideos += 1;
    }
  }

  const fileBucket = client.storage.from(getFilesBucket());
  for (const group of chunk(files, 8)) {
    const results = await Promise.all(
      group.map(async (file) => {
        const path = String(file.file_path ?? "").trim();
        if (!path) return false;
        const { data, error } = await fileBucket.info(path);
        return Boolean(data && !error);
      }),
    );
    summary.checkedFiles += results.length;
    summary.missingFiles += results.filter((exists) => !exists).length;
  }

  return summary;
}

async function getRecentErrors(
  client: SupabaseClient,
  ownerId: string,
): Promise<SystemErrorLog[]> {
  const { data, error } = await client
    .from("system_error_logs")
    .select("id,source,message,path,request_id,created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return [];
  return (data ?? []) as SystemErrorLog[];
}

function overallStatus(checks: SystemDiagnostic[]): DiagnosticStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

function chunk<T>(values: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}
