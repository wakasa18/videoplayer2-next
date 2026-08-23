import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { processAssignmentAutomation } from "@/lib/assignments/automation";
import { getFilesBucket, getVideosBucket } from "@/lib/supabase/admin";
import { PHASE10_RELEASE } from "@/lib/system/release";
import { getWorkspaceQuotaBytes } from "@/lib/workspace/server";
import type {
  MaintenanceCleanup,
  MaintenanceReport,
  MaintenanceStatus,
  MaintenanceTiming,
} from "@/lib/maintenance/types";

const DAY_MS = 24 * 60 * 60 * 1000;

type FileRow = {
  id: number;
  file_size: number | null;
  file_path: string | null;
  status: string | null;
  created_at: string | null;
};

type VideoRow = {
  id: number;
  file_size: number | null;
  file_path: string | null;
  status: string | null;
  created_at: string | null;
};

export async function collectMaintenanceReport(
  client: SupabaseClient,
  ownerId: string,
): Promise<MaintenanceReport> {
  const timings: MaintenanceTiming[] = [];
  const warnings: string[] = [];
  const now = Date.now();
  const staleCutoff = new Date(now - DAY_MS).toISOString();
  const errors24Cutoff = new Date(now - DAY_MS).toISOString();
  const errors7Cutoff = new Date(now - 7 * DAY_MS).toISOString();
  const errors30Cutoff = new Date(now - 30 * DAY_MS).toISOString();

  const filesResult = await timed("File metadata", timings, async () =>
    await client
      .from("important_files")
      .select("id,file_size,file_path,status,created_at")
      .eq("owner_id", ownerId)
      .limit(10000),
  );
  const videosResult = await timed("Video metadata", timings, async () =>
    await client
      .from("videos")
      .select("id,file_size,file_path,status,created_at")
      .eq("owner_id", ownerId)
      .limit(10000),
  );
  const errorsResult = await timed("Error history", timings, async () =>
    await client
      .from("system_error_logs")
      .select("id,created_at")
      .eq("owner_id", ownerId)
      .gte("created_at", errors30Cutoff)
      .limit(10000),
  );

  if (filesResult.error) warnings.push(`Files: ${filesResult.error.message}`);
  if (videosResult.error) warnings.push(`Videos: ${videosResult.error.message}`);
  if (errorsResult.error) warnings.push(`Errors: ${errorsResult.error.message}`);

  const files = (filesResult.data ?? []) as FileRow[];
  const videos = (videosResult.data ?? []) as VideoRow[];
  const errors = (errorsResult.data ?? []) as Array<{ id: number; created_at: string | null }>;
  const activeFiles = files.filter((item) => item.status === "active");
  const activeVideos = videos.filter((item) => item.status === "active");
  const pendingFiles = files.filter((item) => item.status === "pending");
  const pendingVideos = videos.filter((item) => item.status === "pending");
  const stalePendingFiles = pendingFiles.filter((item) => String(item.created_at ?? "") < staleCutoff);
  const stalePendingVideos = pendingVideos.filter((item) => String(item.created_at ?? "") < staleCutoff);
  const fileBytes = sumBytes(activeFiles);
  const videoBytes = sumBytes(activeVideos);
  const totalBytes = fileBytes + videoBytes;
  const quotaBytes = getWorkspaceQuotaBytes();
  const quotaPercent = quotaBytes > 0 ? Math.min(999, (totalBytes / quotaBytes) * 100) : 0;

  const sampledFiles = activeFiles.filter((item) => item.file_path).slice(0, 8);
  const sampledVideos = activeVideos.filter((item) => item.file_path).slice(0, 6);
  const objectAudit = await timed("Storage object sample", timings, async () => {
    const [fileChecks, videoChecks] = await Promise.all([
      Promise.all(sampledFiles.map((item) => storageObjectExists(client, getFilesBucket(), item.file_path))),
      Promise.all(sampledVideos.map((item) => storageObjectExists(client, getVideosBucket(), item.file_path))),
    ]);
    return {
      missingFiles: fileChecks.filter((exists) => !exists).length,
      missingVideos: videoChecks.filter((exists) => !exists).length,
    };
  });

  const rateLimitCheck = await client.rpc("phase10_consume_rate_limit", {
    p_bucket_key: "diagnostic-0000000000000000000000000000000000000000000000000000000000",
    p_limit: 10000,
    p_window_seconds: 60,
  });
  const rateLimitFunction = !rateLimitCheck.error;

  const errors24h = countSince(errors, errors24Cutoff);
  const errors7d = countSince(errors, errors7Cutoff);
  const errors30d = errors.length;
  const missingFiles = objectAudit.missingFiles;
  const missingVideos = objectAudit.missingVideos;

  if (quotaPercent >= 80) warnings.push(`Storage usage is ${quotaPercent.toFixed(1)}% of the configured quota.`);
  if (stalePendingFiles.length || stalePendingVideos.length) warnings.push("Stale pending uploads are ready for cleanup.");
  if (missingFiles || missingVideos) warnings.push("One or more sampled database records point to missing Storage objects.");
  if (errors24h) warnings.push(`${errors24h} application error${errors24h === 1 ? " was" : "s were"} recorded in the last 24 hours.`);
  if (!rateLimitFunction) warnings.push("Phase 10 rate limiting is unavailable until its SQL migration is applied.");
  const slow = timings.filter((item) => item.status === "slow");
  if (slow.length) warnings.push(`${slow.length} maintenance check${slow.length === 1 ? " is" : "s are"} slower than two seconds.`);

  const critical = Boolean(filesResult.error || videosResult.error || quotaPercent >= 100);
  const attention = Boolean(warnings.length);
  const status: MaintenanceStatus = critical ? "critical" : attention ? "attention" : "healthy";
  const summary = critical
    ? "Critical post-launch maintenance issues require attention."
    : attention
      ? `${warnings.length} maintenance item${warnings.length === 1 ? " needs" : "s need"} review.`
      : "Production maintenance checks passed without warnings.";

  return {
    release: PHASE10_RELEASE,
    generatedAt: new Date().toISOString(),
    status,
    summary,
    storage: {
      activeFiles: activeFiles.length,
      activeVideos: activeVideos.length,
      fileBytes,
      videoBytes,
      totalBytes,
      quotaBytes,
      quotaPercent,
      missingFiles,
      missingVideos,
      sampledObjects: sampledFiles.length + sampledVideos.length,
    },
    records: {
      pendingFiles: pendingFiles.length,
      pendingVideos: pendingVideos.length,
      stalePendingFiles: stalePendingFiles.length,
      stalePendingVideos: stalePendingVideos.length,
      errors24h,
      errors7d,
      errors30d,
    },
    configuration: {
      serverSecret: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
      cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
      rateLimitFunction,
      errorRetentionDays: getRetentionDays(),
    },
    timings,
    warnings,
  };
}

export async function createMaintenanceRun(
  client: SupabaseClient,
  ownerId: string,
  runType: "manual" | "cron" | "cleanup",
  options: { cleanup?: boolean } = {},
): Promise<{ report: MaintenanceReport; runId: string | null }> {
  const startedAt = new Date().toISOString();
  let cleanup: MaintenanceCleanup | undefined;
  if (options.cleanup) cleanup = await cleanupMaintenanceData(client, ownerId);
  const report = await collectMaintenanceReport(client, ownerId);
  if (cleanup) report.cleanup = cleanup;

  const { data, error } = await client
    .from("maintenance_runs")
    .insert({
      owner_id: ownerId,
      run_type: runType,
      status: report.status,
      summary: report.summary,
      report,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      created_at: startedAt,
    })
    .select("id")
    .single();

  return { report, runId: error ? null : String(data?.id ?? "") || null };
}

export async function cleanupMaintenanceData(
  client: SupabaseClient,
  ownerId: string,
): Promise<MaintenanceCleanup> {
  const cutoff = new Date(Date.now() - DAY_MS).toISOString();
  const retentionCutoff = new Date(Date.now() - getRetentionDays() * DAY_MS).toISOString();
  const [filesResult, videosResult] = await Promise.all([
    client.from("important_files").select("id,file_path").eq("owner_id", ownerId).eq("status", "pending").lt("created_at", cutoff),
    client.from("videos").select("id,file_path").eq("owner_id", ownerId).eq("status", "pending").lt("created_at", cutoff),
  ]);

  const staleFiles = (filesResult.data ?? []) as Array<{ id: number; file_path: string | null }>;
  const staleVideos = (videosResult.data ?? []) as Array<{ id: number; file_path: string | null }>;
  const filePaths = staleFiles.map((item) => item.file_path).filter(isNonEmptyString);
  const videoPaths = staleVideos.map((item) => item.file_path).filter(isNonEmptyString);
  if (filePaths.length) await client.storage.from(getFilesBucket()).remove(filePaths);
  if (videoPaths.length) await client.storage.from(getVideosBucket()).remove(videoPaths);

  let staleFilesDeleted = 0;
  let staleVideosDeleted = 0;
  if (staleFiles.length) {
    const { count } = await client.from("important_files").delete({ count: "exact" }).eq("owner_id", ownerId).eq("status", "pending").lt("created_at", cutoff);
    staleFilesDeleted = count ?? 0;
  }
  if (staleVideos.length) {
    const { count } = await client.from("videos").delete({ count: "exact" }).eq("owner_id", ownerId).eq("status", "pending").lt("created_at", cutoff);
    staleVideosDeleted = count ?? 0;
  }
  const { count: oldErrorsDeleted } = await client.from("system_error_logs").delete({ count: "exact" }).eq("owner_id", ownerId).lt("created_at", retentionCutoff);
  const { count: expiredRateLimitsDeleted } = await client.from("api_rate_limits").delete({ count: "exact" }).lt("expires_at", new Date().toISOString());

  return {
    staleFilesDeleted,
    staleVideosDeleted,
    oldErrorsDeleted: oldErrorsDeleted ?? 0,
    expiredRateLimitsDeleted: expiredRateLimitsDeleted ?? 0,
  };
}

export async function runDailyMaintenanceForAllOwners(client: SupabaseClient) {
  const assignmentResult = await processAssignmentAutomation(client, { source: "cron" });
  const { data, error } = await client.from("workspace_profiles").select("owner_id").limit(500);
  if (error) throw new Error(error.message);
  const ownerIds = Array.from(new Set((data ?? []).map((row) => String(row.owner_id)).filter(Boolean)));
  const results = [];
  for (const ownerId of ownerIds) {
    try {
      const run = await createMaintenanceRun(client, ownerId, "cron", { cleanup: true });
      results.push({ ownerId, status: run.report.status, runId: run.runId });
    } catch (error_) {
      results.push({ ownerId, status: "critical", error: error_ instanceof Error ? error_.message : "Maintenance failed." });
    }
  }
  return { assignmentAutomation: assignmentResult, ownersProcessed: ownerIds.length, results };
}

function getRetentionDays(): number {
  const value = Number.parseInt(String(process.env.MAINTENANCE_ERROR_RETENTION_DAYS ?? ""), 10);
  return Number.isSafeInteger(value) && value >= 7 && value <= 3650 ? value : 90;
}

async function storageObjectExists(client: SupabaseClient, bucket: string, path: string | null): Promise<boolean> {
  if (!path) return false;
  const { data, error } = await client.storage.from(bucket).info(path);
  return Boolean(data && !error);
}

function sumBytes(rows: Array<{ file_size: number | null }>): number {
  return rows.reduce((total, row) => total + Math.max(0, Number(row.file_size ?? 0) || 0), 0);
}

function countSince(rows: Array<{ created_at: string | null }>, cutoff: string): number {
  return rows.filter((row) => String(row.created_at ?? "") >= cutoff).length;
}

async function timed<T>(label: string, timings: MaintenanceTiming[], task: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await task();
  } finally {
    const milliseconds = Math.round(performance.now() - started);
    timings.push({ label, milliseconds, status: milliseconds > 2000 ? "slow" : milliseconds > 750 ? "review" : "fast" });
  }
}

function isNonEmptyString(value: string | null): value is string {
  return Boolean(value && value.trim());
}
