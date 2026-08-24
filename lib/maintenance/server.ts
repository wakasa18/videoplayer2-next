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
const STORAGE_FILE_SAMPLE_LIMIT = 25;
const STORAGE_VIDEO_SAMPLE_LIMIT = 20;
const CRON_FRESH_MS = 36 * 60 * 60 * 1000;

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

type ErrorRow = {
  id: number;
  source: string | null;
  message: string | null;
  digest: string | null;
  path: string | null;
  created_at: string | null;
};

type CronRow = {
  status: MaintenanceStatus | null;
  completed_at: string | null;
  created_at: string | null;
};

type StorageAuditResult = {
  state: "exists" | "missing" | "error";
  message: string | null;
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

  const [filesResult, videosResult, errorsResult, cronResult] = await Promise.all([
    timed("File metadata", timings, async () =>
      await client
        .from("important_files")
        .select("id,file_size,file_path,status,created_at")
        .eq("owner_id", ownerId)
        .order("id", { ascending: true })
        .limit(10000),
    ),
    timed("Video metadata", timings, async () =>
      await client
        .from("videos")
        .select("id,file_size,file_path,status,created_at")
        .eq("owner_id", ownerId)
        .order("id", { ascending: true })
        .limit(10000),
    ),
    timed("Error history", timings, async () =>
      await client
        .from("system_error_logs")
        .select("id,source,message,digest,path,created_at")
        .eq("owner_id", ownerId)
        .gte("created_at", errors30Cutoff)
        .order("created_at", { ascending: false })
        .limit(10000),
    ),
    timed("Cron history", timings, async () =>
      await client
        .from("maintenance_runs")
        .select("status,completed_at,created_at")
        .eq("owner_id", ownerId)
        .eq("run_type", "cron")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  ]);

  if (filesResult.error) warnings.push(`Files: ${filesResult.error.message}`);
  if (videosResult.error) warnings.push(`Videos: ${videosResult.error.message}`);
  if (errorsResult.error) warnings.push(`Errors: ${errorsResult.error.message}`);
  if (cronResult.error) warnings.push(`Cron history: ${cronResult.error.message}`);
  if (!filesResult.error && (filesResult.data?.length ?? 0) >= 10000) {
    warnings.push("File metadata reached the 10,000-record maintenance limit; totals may be incomplete.");
  }
  if (!videosResult.error && (videosResult.data?.length ?? 0) >= 10000) {
    warnings.push("Video metadata reached the 10,000-record maintenance limit; totals may be incomplete.");
  }
  if (!errorsResult.error && (errorsResult.data?.length ?? 0) >= 10000) {
    warnings.push("Error history reached the 10,000-record maintenance limit; error totals may be incomplete.");
  }

  const files = (filesResult.data ?? []) as FileRow[];
  const videos = (videosResult.data ?? []) as VideoRow[];
  const errors = (errorsResult.data ?? []) as ErrorRow[];
  const cron = (cronResult.data ?? null) as CronRow | null;

  const activeFiles = files.filter((item) => item.status === "active");
  const activeVideos = videos.filter((item) => item.status === "active");
  const pendingFiles = files.filter((item) => item.status === "pending");
  const pendingVideos = videos.filter((item) => item.status === "pending");
  const stalePendingFiles = pendingFiles.filter(
    (item) => String(item.created_at ?? "") < staleCutoff,
  );
  const stalePendingVideos = pendingVideos.filter(
    (item) => String(item.created_at ?? "") < staleCutoff,
  );

  const missingPathFiles = activeFiles.filter((item) => !isNonEmptyString(item.file_path)).length;
  const missingPathVideos = activeVideos.filter((item) => !isNonEmptyString(item.file_path)).length;
  const invalidFileSizes = activeFiles.filter((item) => !isPositiveSize(item.file_size)).length;
  const invalidVideoSizes = activeVideos.filter((item) => !isPositiveSize(item.file_size)).length;

  const fileBytes = sumBytes(activeFiles);
  const videoBytes = sumBytes(activeVideos);
  const totalBytes = fileBytes + videoBytes;
  const quotaBytes = getWorkspaceQuotaBytes();
  const quotaPercent = quotaBytes > 0 ? Math.min(999, (totalBytes / quotaBytes) * 100) : 0;

  const fileCandidates = activeFiles.filter((item) => isNonEmptyString(item.file_path));
  const videoCandidates = activeVideos.filter((item) => isNonEmptyString(item.file_path));
  const sampledFiles = sampleEvenly(fileCandidates, STORAGE_FILE_SAMPLE_LIMIT);
  const sampledVideos = sampleEvenly(videoCandidates, STORAGE_VIDEO_SAMPLE_LIMIT);
  const auditCandidates = fileCandidates.length + videoCandidates.length;
  const objectAudit = await timed("Storage object audit", timings, async () => {
    const [fileChecks, videoChecks] = await Promise.all([
      Promise.all(
        sampledFiles.map((item) =>
          inspectStorageObject(client, getFilesBucket(), item.file_path),
        ),
      ),
      Promise.all(
        sampledVideos.map((item) =>
          inspectStorageObject(client, getVideosBucket(), item.file_path),
        ),
      ),
    ]);
    const allChecks = [...fileChecks, ...videoChecks];
    return {
      missingFiles: fileChecks.filter((result) => result.state === "missing").length,
      missingVideos: videoChecks.filter((result) => result.state === "missing").length,
      auditErrors: allChecks.filter((result) => result.state === "error").length,
      errorMessages: Array.from(
        new Set(
          allChecks
            .filter((result) => result.state === "error" && result.message)
            .map((result) => String(result.message)),
        ),
      ).slice(0, 3),
    };
  });
  const auditedObjects = sampledFiles.length + sampledVideos.length;
  const auditCoveragePercent =
    auditCandidates > 0 ? Math.min(100, (auditedObjects / auditCandidates) * 100) : 100;

  const rateLimitCheck = await client.rpc("phase10_consume_rate_limit", {
    p_bucket_key: `diagnostic-${ownerId}`.slice(0, 120),
    p_limit: 10000,
    p_window_seconds: 60,
  });
  const rateLimitFunction = !rateLimitCheck.error;

  const errors24Rows = rowsSince(errors, errors24Cutoff);
  const errors7Rows = rowsSince(errors, errors7Cutoff);
  const uniqueErrors24 = uniqueErrors(errors24Rows);
  const uniqueErrors7 = uniqueErrors(errors7Rows);
  const uniqueErrors30 = uniqueErrors(errors);
  const errors24h = uniqueErrors24.length;
  const errors7d = uniqueErrors7.length;
  const errors30d = uniqueErrors30.length;
  const recentErrors = uniqueErrors30.slice(0, 8).map((item) => ({
    id: item.row.id,
    source: item.row.source || "application",
    message: item.row.message || "Unknown application error",
    digest: item.row.digest,
    path: item.row.path,
    createdAt: item.row.created_at || new Date().toISOString(),
    occurrences: item.occurrences,
  }));

  const lastCronRunAt = cron?.completed_at || cron?.created_at || null;
  const lastCronStatus = normalizeMaintenanceStatus(cron?.status);
  const cronFresh = Boolean(
    lastCronRunAt &&
      Number.isFinite(new Date(lastCronRunAt).getTime()) &&
      now - new Date(lastCronRunAt).getTime() <= CRON_FRESH_MS,
  );
  const serverSecret = Boolean(
    process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY,
  );
  const cronSecret = Boolean(process.env.CRON_SECRET?.trim());

  if (quotaPercent >= 80) {
    warnings.push(`Storage usage is ${quotaPercent.toFixed(1)}% of the configured quota.`);
  }
  if (stalePendingFiles.length || stalePendingVideos.length) {
    warnings.push("Stale pending uploads are ready for cleanup.");
  }
  if (missingPathFiles || missingPathVideos) {
    warnings.push(
      `${missingPathFiles + missingPathVideos} active database record(s) have no Storage path.`,
    );
  }
  if (invalidFileSizes || invalidVideoSizes) {
    warnings.push(
      `${invalidFileSizes + invalidVideoSizes} active record(s) have a missing or invalid file size.`,
    );
  }
  if (objectAudit.missingFiles || objectAudit.missingVideos) {
    warnings.push("One or more audited database records point to missing Storage objects.");
  }
  if (objectAudit.auditErrors) {
    warnings.push(
      `Storage auditing could not verify ${objectAudit.auditErrors} object(s): ${objectAudit.errorMessages.join("; ") || "Storage request failed."}`,
    );
  }
  if (errors24h) {
    const reportCount = errors24Rows.length;
    warnings.push(
      `${errors24h} unique application error${errors24h === 1 ? " was" : "s were"} recorded in the last 24 hours (${reportCount} report${reportCount === 1 ? "" : "s"}).`,
    );
  }
  if (!serverSecret) {
    warnings.push("A Supabase server secret is not configured; scheduled maintenance cannot use owner-safe admin access.");
  }
  if (!cronSecret) {
    warnings.push("CRON_SECRET is not configured, so daily maintenance requests will be rejected.");
  }
  if (!cronFresh) {
    warnings.push(
      lastCronRunAt
        ? `The last daily maintenance run was ${formatAge(now - new Date(lastCronRunAt).getTime())} ago.`
        : "No completed daily maintenance run is recorded yet.",
    );
  }
  if (lastCronStatus === "critical") {
    warnings.push("The latest daily maintenance run finished with a critical status.");
  }
  if (!rateLimitFunction) {
    warnings.push("Phase 10 rate limiting is unavailable until its SQL migration is applied.");
  }
  const slow = timings.filter((item) => item.status === "slow");
  if (slow.length) {
    warnings.push(
      `${slow.length} maintenance check${slow.length === 1 ? " is" : "s are"} slower than two seconds.`,
    );
  }

  const critical = Boolean(
    filesResult.error ||
      videosResult.error ||
      errorsResult.error ||
      quotaPercent >= 100 ||
      !serverSecret ||
      !cronSecret,
  );
  const attention = Boolean(warnings.length);
  const status: MaintenanceStatus = critical
    ? "critical"
    : attention
      ? "attention"
      : "healthy";
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
      missingFiles: objectAudit.missingFiles,
      missingVideos: objectAudit.missingVideos,
      missingPathFiles,
      missingPathVideos,
      invalidFileSizes,
      invalidVideoSizes,
      auditErrors: objectAudit.auditErrors,
      auditedObjects,
      auditCandidates,
      auditCoveragePercent,
      sampledObjects: auditedObjects,
    },
    records: {
      pendingFiles: pendingFiles.length,
      pendingVideos: pendingVideos.length,
      stalePendingFiles: stalePendingFiles.length,
      stalePendingVideos: stalePendingVideos.length,
      errors24h,
      errors7d,
      errors30d,
      errorReports24h: errors24Rows.length,
      errorReports7d: errors7Rows.length,
      errorReports30d: errors.length,
    },
    recentErrors,
    configuration: {
      serverSecret,
      cronSecret,
      rateLimitFunction,
      errorRetentionDays: getRetentionDays(),
      cronFresh,
      lastCronRunAt,
      lastCronStatus,
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

  if (error) {
    report.warnings.unshift(`Maintenance history could not be saved: ${error.message}`);
    report.status = "critical";
    report.summary = "Maintenance checks completed, but the history record could not be saved.";
    return { report, runId: null };
  }

  return { report, runId: String(data?.id ?? "") || null };
}

export async function cleanupMaintenanceData(
  client: SupabaseClient,
  ownerId: string,
): Promise<MaintenanceCleanup> {
  const cutoff = new Date(Date.now() - DAY_MS).toISOString();
  const retentionCutoff = new Date(
    Date.now() - getRetentionDays() * DAY_MS,
  ).toISOString();
  const [filesResult, videosResult] = await Promise.all([
    client
      .from("important_files")
      .select("id,file_path")
      .eq("owner_id", ownerId)
      .eq("status", "pending")
      .lt("created_at", cutoff),
    client
      .from("videos")
      .select("id,file_path")
      .eq("owner_id", ownerId)
      .eq("status", "pending")
      .lt("created_at", cutoff),
  ]);

  if (filesResult.error) throw new Error(`Could not inspect stale files: ${filesResult.error.message}`);
  if (videosResult.error) throw new Error(`Could not inspect stale videos: ${videosResult.error.message}`);

  const staleFiles = (filesResult.data ?? []) as Array<{
    id: number;
    file_path: string | null;
  }>;
  const staleVideos = (videosResult.data ?? []) as Array<{
    id: number;
    file_path: string | null;
  }>;
  const filePaths = staleFiles.map((item) => item.file_path).filter(isNonEmptyString);
  const videoPaths = staleVideos.map((item) => item.file_path).filter(isNonEmptyString);

  if (filePaths.length) {
    const { error } = await client.storage.from(getFilesBucket()).remove(filePaths);
    if (error && !isNotFoundError(error)) {
      throw new Error(`Could not remove stale file objects: ${storageErrorMessage(error)}`);
    }
  }
  if (videoPaths.length) {
    const { error } = await client.storage.from(getVideosBucket()).remove(videoPaths);
    if (error && !isNotFoundError(error)) {
      throw new Error(`Could not remove stale video objects: ${storageErrorMessage(error)}`);
    }
  }

  let staleFilesDeleted = 0;
  let staleVideosDeleted = 0;
  if (staleFiles.length) {
    const { count, error } = await client
      .from("important_files")
      .delete({ count: "exact" })
      .eq("owner_id", ownerId)
      .eq("status", "pending")
      .lt("created_at", cutoff);
    if (error) throw new Error(`Could not delete stale file records: ${error.message}`);
    staleFilesDeleted = count ?? 0;
  }
  if (staleVideos.length) {
    const { count, error } = await client
      .from("videos")
      .delete({ count: "exact" })
      .eq("owner_id", ownerId)
      .eq("status", "pending")
      .lt("created_at", cutoff);
    if (error) throw new Error(`Could not delete stale video records: ${error.message}`);
    staleVideosDeleted = count ?? 0;
  }

  const { count: oldErrorsDeleted, error: oldErrorsError } = await client
    .from("system_error_logs")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId)
    .lt("created_at", retentionCutoff);
  if (oldErrorsError) throw new Error(`Could not delete expired error logs: ${oldErrorsError.message}`);

  const { count: expiredRateLimitsDeleted, error: rateLimitError } = await client
    .from("api_rate_limits")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());
  if (rateLimitError) throw new Error(`Could not delete expired rate limits: ${rateLimitError.message}`);

  return {
    staleFilesDeleted,
    staleVideosDeleted,
    oldErrorsDeleted: oldErrorsDeleted ?? 0,
    expiredRateLimitsDeleted: expiredRateLimitsDeleted ?? 0,
  };
}

export async function runDailyMaintenanceForAllOwners(client: SupabaseClient) {
  const assignmentResult = await processAssignmentAutomation(client, {
    source: "cron",
  });
  const { data, error } = await client
    .from("workspace_profiles")
    .select("owner_id")
    .limit(501);
  if (error) throw new Error(error.message);
  if ((data ?? []).length > 500) {
    throw new Error("Daily maintenance supports up to 500 owners per run. Increase the batching strategy before adding more accounts.");
  }
  const ownerIds = Array.from(
    new Set((data ?? []).map((row) => String(row.owner_id)).filter(Boolean)),
  );
  const results = [];
  for (const ownerId of ownerIds) {
    try {
      const run = await createMaintenanceRun(client, ownerId, "cron", {
        cleanup: true,
      });
      results.push({
        ownerId,
        status: run.report.status,
        runId: run.runId,
        persisted: Boolean(run.runId),
      });
    } catch (error_) {
      results.push({
        ownerId,
        status: "critical",
        error:
          error_ instanceof Error ? error_.message : "Maintenance failed.",
      });
    }
  }
  return {
    assignmentAutomation: assignmentResult,
    ownersProcessed: ownerIds.length,
    results,
  };
}

function getRetentionDays(): number {
  const value = Number.parseInt(
    String(process.env.MAINTENANCE_ERROR_RETENTION_DAYS ?? ""),
    10,
  );
  return Number.isSafeInteger(value) && value >= 7 && value <= 3650 ? value : 90;
}

async function inspectStorageObject(
  client: SupabaseClient,
  bucket: string,
  path: string | null,
): Promise<StorageAuditResult> {
  if (!isNonEmptyString(path)) {
    return { state: "missing", message: "Storage path is empty." };
  }
  const { data, error } = await client.storage.from(bucket).info(path);
  if (data && !error) return { state: "exists", message: null };
  if (error && isNotFoundError(error)) {
    return { state: "missing", message: storageErrorMessage(error) };
  }
  return {
    state: "error",
    message: error ? storageErrorMessage(error) : "Storage returned no object information.",
  };
}

function isNotFoundError(error: unknown): boolean {
  const message = storageErrorMessage(error).toLowerCase();
  const status = Number(
    (error as { status?: unknown; statusCode?: unknown } | null)?.statusCode ??
      (error as { status?: unknown } | null)?.status,
  );
  return status === 404 || /not found|object not found|no such object/.test(message);
}

function storageErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Storage request failed.").slice(0, 300);
  }
  return String(error ?? "Storage request failed.").slice(0, 300);
}

function sumBytes(rows: Array<{ file_size: number | null }>): number {
  return rows.reduce(
    (total, row) => total + Math.max(0, Number(row.file_size ?? 0) || 0),
    0,
  );
}

function rowsSince<T extends { created_at: string | null }>(
  rows: T[],
  cutoff: string,
): T[] {
  return rows.filter((row) => String(row.created_at ?? "") >= cutoff);
}

function uniqueErrors(
  rows: ErrorRow[],
): Array<{ row: ErrorRow; occurrences: number }> {
  const grouped = new Map<string, { row: ErrorRow; occurrences: number }>();
  for (const row of rows) {
    const fingerprint = errorFingerprint(row);
    const current = grouped.get(fingerprint);
    if (current) current.occurrences += 1;
    else grouped.set(fingerprint, { row, occurrences: 1 });
  }
  return Array.from(grouped.values()).sort((left, right) =>
    String(right.row.created_at ?? "").localeCompare(
      String(left.row.created_at ?? ""),
    ),
  );
}

function errorFingerprint(row: ErrorRow): string {
  return String(
    row.digest ||
      `${row.source ?? "application"}|${row.path ?? ""}|${row.message ?? ""}`,
  ).trim();
}

function sampleEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  if (limit <= 1) return items.slice(0, Math.max(0, limit));
  const selected: T[] = [];
  const lastIndex = items.length - 1;
  for (let index = 0; index < limit; index += 1) {
    selected.push(items[Math.round((index * lastIndex) / (limit - 1))]);
  }
  return selected;
}

function normalizeMaintenanceStatus(value: unknown): MaintenanceStatus | null {
  return value === "healthy" || value === "attention" || value === "critical"
    ? value
    : null;
}

function isPositiveSize(value: number | null): boolean {
  const size = Number(value);
  return Number.isFinite(size) && size > 0;
}

function formatAge(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "an unknown time";
  const hours = Math.max(1, Math.round(milliseconds / (60 * 60 * 1000)));
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

async function timed<T>(
  label: string,
  timings: MaintenanceTiming[],
  task: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await task();
  } finally {
    const milliseconds = Math.round(performance.now() - started);
    timings.push({
      label,
      milliseconds,
      status: milliseconds > 2000 ? "slow" : milliseconds > 750 ? "review" : "fast",
    });
  }
}

function isNonEmptyString(value: string | null): value is string {
  return Boolean(value && value.trim());
}
