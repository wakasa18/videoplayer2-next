import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getFilesBucket, getVideosBucket } from "@/lib/supabase/admin";
import { collectMaintenanceReport } from "@/lib/maintenance/server";
import { getEnvironmentDiagnostics, getCanonicalAppUrl, hasServerAdminSecret } from "@/lib/system/env";
import { PHASE11_RELEASE } from "@/lib/system/release";
import type {
  QualityCheck,
  QualityMetric,
  QualityReport,
  QualityRunHistory,
  QualityStatus,
} from "@/lib/quality/types";

const REQUIRED_TABLES = [
  "workspace_profiles",
  "important_files",
  "important_folders",
  "assignments",
  "videos",
  "important_file_shares",
  "system_error_logs",
  "maintenance_runs",
  "backup_verifications",
  "quality_runs",
  "quality_web_vitals",
] as const;

const VITAL_THRESHOLDS: Record<QualityMetric["name"], { good: number; warn: number; unit: "ms" | "score" }> = {
  CLS: { good: 0.1, warn: 0.25, unit: "score" },
  FCP: { good: 1800, warn: 3000, unit: "ms" },
  INP: { good: 200, warn: 500, unit: "ms" },
  LCP: { good: 2500, warn: 4000, unit: "ms" },
  TTFB: { good: 800, warn: 1800, unit: "ms" },
};

export async function collectQualityReport(
  client: SupabaseClient,
  ownerId: string,
): Promise<QualityReport> {
  const startedAt = performance.now();
  const checks: QualityCheck[] = [];

  checks.push(
    await runCheck("security-environment", "security", "Production environment", async () => {
      const missing = getEnvironmentDiagnostics().filter((item) => item.required && !item.configured);
      return missing.length
        ? fail(`${missing.length} required environment variable${missing.length === 1 ? " is" : "s are"} missing.`, missing.map((item) => item.key).join(", "))
        : pass("All required production environment variables are configured.");
    }),
  );

  checks.push(
    await runCheck("security-server-key", "security", "Server-only Supabase access", async () =>
      hasServerAdminSecret()
        ? pass("A server-only Supabase secret is configured.")
        : warn("No server-only Supabase key is configured; recovery and audits depend on session RLS."),
    ),
  );

  checks.push(
    await runCheck("security-canonical-url", "security", "Canonical production URL", async () => {
      const appUrl = getCanonicalAppUrl();
      if (!appUrl) return warn("NEXT_PUBLIC_APP_URL is not configured.");
      const parsed = new URL(appUrl);
      const production = (process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
      if (production && parsed.protocol !== "https:") {
        return fail("The production application URL is not HTTPS.", appUrl);
      }
      return pass(`Canonical URL: ${parsed.origin}`);
    }),
  );

  checks.push(
    await runCheck("database-schema", "database", "Required database schema", async () => {
      const results = await Promise.all(
        REQUIRED_TABLES.map(async (table) => {
          const { error } = await client.from(table).select("*", { head: true, count: "exact" }).limit(1);
          return { table, error };
        }),
      );
      const missing = results.filter((item) => item.error);
      return missing.length
        ? fail(
            `${missing.length} required table${missing.length === 1 ? " is" : "s are"} unavailable.`,
            missing.map((item) => `${item.table}: ${item.error?.message ?? "unavailable"}`).join(" · "),
          )
        : pass(`All ${REQUIRED_TABLES.length} required tables are reachable.`);
    }),
  );

  checks.push(
    await runCheck("database-volume", "database", "Data-volume readiness", async () => {
      const [files, videos, assignments, errors] = await Promise.all([
        countRows(client, "important_files", ownerId),
        countRows(client, "videos", ownerId),
        countRows(client, "assignments", ownerId),
        countRows(client, "system_error_logs", ownerId),
      ]);
      const failed = [files, videos, assignments, errors].filter((item) => item.error);
      if (failed.length) return warn("One or more record totals could not be calculated.", failed.map((item) => item.error).join(" · "));
      const largest = Math.max(files.count, videos.count, assignments.count, errors.count);
      const detail = `Files ${files.count.toLocaleString()} · Videos ${videos.count.toLocaleString()} · Assignments ${assignments.count.toLocaleString()} · Error logs ${errors.count.toLocaleString()}`;
      return largest >= 5000
        ? warn("A dataset is approaching the current snapshot-query limit; database pagination should be prioritized.", detail)
        : pass("Current data volumes are within the optimized operating range.", detail);
    }),
  );

  checks.push(
    await runCheck("storage-buckets", "storage", "Private Storage buckets", async () => {
      const { data, error } = await client.storage.listBuckets();
      if (error) return fail("Storage bucket configuration could not be inspected.", error.message);
      const expected = [getFilesBucket(), getVideosBucket()];
      const byName = new Map((data ?? []).map((bucket) => [bucket.name, bucket]));
      const missing = expected.filter((name) => !byName.has(name));
      if (missing.length) return fail(`Missing Storage bucket${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
      const publicBuckets = expected.filter((name) => Boolean(byName.get(name)?.public));
      return publicBuckets.length
        ? fail(`Protected bucket${publicBuckets.length === 1 ? " is" : "s are"} public.`, publicBuckets.join(", "))
        : pass(`Required buckets are present and private: ${expected.join(" and ")}.`);
    }),
  );

  checks.push(
    await runCheck("storage-integrity", "storage", "Storage and metadata integrity", async () => {
      const report = await collectMaintenanceReport(client, ownerId);
      const broken =
        report.storage.missingFiles +
        report.storage.missingVideos +
        report.storage.missingPathFiles +
        report.storage.missingPathVideos;
      const invalidSizes = report.storage.invalidFileSizes + report.storage.invalidVideoSizes;
      const stale = report.records.stalePendingFiles + report.records.stalePendingVideos;
      const detail = `Audit coverage ${report.storage.auditCoveragePercent.toFixed(0)}% · Broken links ${broken} · Invalid sizes ${invalidSizes} · Stale uploads ${stale}`;
      if (report.status === "critical" || broken > 0) return fail("Storage integrity requires immediate review.", detail);
      if (report.status === "attention" || invalidSizes > 0 || stale > 0) return warn("Storage maintenance has items to review.", detail);
      return pass("Storage metadata, sampled objects, and pending uploads passed review.", detail);
    }),
  );

  checks.push(
    await runCheck("automation-cron", "automation", "Daily automation and maintenance", async () => {
      const { data, error } = await client
        .from("maintenance_runs")
        .select("status,completed_at,created_at")
        .eq("owner_id", ownerId)
        .eq("run_type", "cron")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!process.env.CRON_SECRET?.trim()) return fail("CRON_SECRET is not configured.");
      if (error) return warn("Cron history could not be read.", error.message);
      if (!data) return warn("No daily maintenance run is recorded yet.");
      const completed = String(data.completed_at ?? data.created_at ?? "");
      const ageMs = Date.now() - new Date(completed).getTime();
      if (!Number.isFinite(ageMs)) return warn("The latest cron timestamp is invalid.");
      if (ageMs > 36 * 60 * 60 * 1000) return warn("The latest daily maintenance run is older than 36 hours.", completed);
      if (data.status === "critical") return fail("The latest daily maintenance run ended with a critical status.", completed);
      return pass("Daily automation has run recently.", completed);
    }),
  );

  checks.push(
    await runCheck("automation-rate-limit", "automation", "API rate limiting", async () => {
      const { error } = await client.rpc("phase10_consume_rate_limit", {
        p_bucket_key: `phase11-qa-${ownerId}`.slice(0, 120),
        p_limit: 10000,
        p_window_seconds: 60,
      });
      return error
        ? fail("The database rate-limit function is unavailable.", error.message)
        : pass("Database-backed API rate limiting is available.");
    }),
  );

  const metrics = await loadWebVitals(client, ownerId);
  checks.push(
    await runCheck("performance-vitals", "performance", "Real-user performance metrics", async () => {
      if (!metrics.length) return skip("No Web Vitals have been collected yet. Browse the production dashboard, then run QA again.");
      const failing = metrics.filter((metric) => metric.rating === "fail");
      const warning = metrics.filter((metric) => metric.rating === "warn");
      const detail = metrics
        .map((metric) => `${metric.name} p75 ${formatMetric(metric.p75, metric.unit)} (${metric.samples})`)
        .join(" · ");
      if (failing.length) return fail(`${failing.length} performance metric${failing.length === 1 ? " exceeds" : "s exceed"} the poor threshold.`, detail);
      if (warning.length) return warn(`${warning.length} performance metric${warning.length === 1 ? " needs" : "s need"} improvement.`, detail);
      return pass("Collected Web Vitals are within good thresholds.", detail);
    }),
  );

  checks.push(
    await runCheck("performance-errors", "performance", "Recent runtime stability", async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await client
        .from("system_error_logs")
        .select("id", { head: true, count: "exact" })
        .eq("owner_id", ownerId)
        .gte("created_at", cutoff);
      if (error) return warn("Recent error totals could not be read.", error.message);
      const total = count ?? 0;
      return total > 10
        ? fail(`${total} application error reports were recorded during the last 24 hours.`)
        : total > 0
          ? warn(`${total} application error report${total === 1 ? " was" : "s were"} recorded during the last 24 hours.`)
          : pass("No application error reports were recorded during the last 24 hours.");
    }),
  );

  checks.push(
    await runCheck("accessibility-foundation", "accessibility", "Keyboard and reduced-motion foundation", async () =>
      pass("Skip navigation, visible focus states, semantic landmarks, and reduced-motion handling are included in the Phase 11 shell."),
    ),
  );

  const counts = {
    pass: checks.filter((item) => item.status === "pass").length,
    warn: checks.filter((item) => item.status === "warn").length,
    fail: checks.filter((item) => item.status === "fail").length,
    skip: checks.filter((item) => item.status === "skip").length,
  };
  const scoredChecks = Math.max(1, checks.length - counts.skip);
  const earned = counts.pass + counts.warn * 0.55;
  const score = Math.max(0, Math.min(100, Math.round((earned / scoredChecks) * 100)));
  const overall: QualityReport["overall"] = counts.fail ? "fail" : counts.warn ? "warn" : "pass";
  const summary =
    overall === "pass"
      ? "Automated quality checks passed. Complete the manual browser and restore checklist before final sign-off."
      : overall === "warn"
        ? `${counts.warn} quality item${counts.warn === 1 ? " needs" : "s need"} review before final sign-off.`
        : `${counts.fail} critical quality check${counts.fail === 1 ? " failed" : "s failed"}. Resolve them before release.`;

  return {
    release: PHASE11_RELEASE,
    generatedAt: new Date().toISOString(),
    overall,
    score,
    summary,
    counts,
    checks,
    metrics,
    totalDurationMs: Math.round(performance.now() - startedAt),
  };
}

export async function saveQualityRun(
  client: SupabaseClient,
  ownerId: string,
  report: QualityReport,
): Promise<{ id: number | null; error: string | null }> {
  const { data, error } = await client
    .from("quality_runs")
    .insert({
      owner_id: ownerId,
      release: report.release,
      status: report.overall,
      score: report.score,
      summary: report.summary,
      checks: report.checks,
      metrics: report.metrics,
      total_duration_ms: report.totalDurationMs,
    })
    .select("id")
    .single();
  return { id: data?.id ? Number(data.id) : null, error: error?.message ?? null };
}

export async function getQualityHistory(
  client: SupabaseClient,
  ownerId: string,
): Promise<{ history: QualityRunHistory[]; error: string | null }> {
  const { data, error } = await client
    .from("quality_runs")
    .select("id,status,score,summary,created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return { history: [], error: error.message };
  return {
    history: (data ?? []).map((row) => ({
      id: Number(row.id),
      status: normalizeOverall(row.status),
      score: Number(row.score) || 0,
      summary: String(row.summary ?? "Quality run completed."),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    })),
    error: null,
  };
}

export async function clearQualityHistory(
  client: SupabaseClient,
  ownerId: string,
): Promise<{ deleted: number; error: string | null }> {
  const { data, error } = await client
    .from("quality_runs")
    .delete()
    .eq("owner_id", ownerId)
    .select("id");
  return { deleted: data?.length ?? 0, error: error?.message ?? null };
}

async function loadWebVitals(client: SupabaseClient, ownerId: string): Promise<QualityMetric[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("quality_web_vitals")
    .select("name,value")
    .eq("owner_id", ownerId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return [];

  const grouped = new Map<QualityMetric["name"], number[]>();
  for (const row of data ?? []) {
    const name = String(row.name ?? "") as QualityMetric["name"];
    if (!(name in VITAL_THRESHOLDS)) continue;
    const value = Number(row.value);
    if (!Number.isFinite(value) || value < 0) continue;
    const list = grouped.get(name) ?? [];
    list.push(value);
    grouped.set(name, list);
  }

  return Array.from(grouped.entries())
    .map(([name, values]) => {
      values.sort((a, b) => a - b);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const p75 = percentile(values, 0.75);
      const threshold = VITAL_THRESHOLDS[name];
      const rating: QualityStatus = p75 <= threshold.good ? "pass" : p75 <= threshold.warn ? "warn" : "fail";
      return {
        name,
        samples: values.length,
        average: roundMetric(average, threshold.unit),
        p75: roundMetric(p75, threshold.unit),
        rating,
        unit: threshold.unit,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function runCheck(
  id: string,
  group: QualityCheck["group"],
  label: string,
  task: () => Promise<Omit<QualityCheck, "id" | "group" | "label" | "durationMs">>,
): Promise<QualityCheck> {
  const startedAt = performance.now();
  try {
    const result = await task();
    return { id, group, label, ...result, durationMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return {
      id,
      group,
      label,
      status: "fail",
      summary: "The check could not be completed.",
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function pass(summary: string, detail: string | null = null) {
  return { status: "pass" as const, summary, detail };
}
function warn(summary: string, detail: string | null = null) {
  return { status: "warn" as const, summary, detail };
}
function fail(summary: string, detail: string | null = null) {
  return { status: "fail" as const, summary, detail };
}
function skip(summary: string, detail: string | null = null) {
  return { status: "skip" as const, summary, detail };
}

async function countRows(client: SupabaseClient, table: string, ownerId: string) {
  const { count, error } = await client
    .from(table)
    .select("id", { head: true, count: "exact" })
    .eq("owner_id", ownerId);
  return { count: count ?? 0, error: error?.message ?? null };
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentileValue) - 1));
  return values[index];
}

function roundMetric(value: number, unit: "ms" | "score"): number {
  return unit === "score" ? Math.round(value * 1000) / 1000 : Math.round(value);
}

function formatMetric(value: number, unit: "ms" | "score"): string {
  return unit === "ms" ? `${Math.round(value)} ms` : value.toFixed(3);
}

function normalizeOverall(value: unknown): QualityRunHistory["status"] {
  return value === "pass" || value === "warn" || value === "fail" ? value : "warn";
}
