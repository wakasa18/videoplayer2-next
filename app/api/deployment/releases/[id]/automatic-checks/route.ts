import {
  assertUuid,
  deploymentErrorResponse,
  DeploymentRequestError,
  requireDeploymentContext,
  writeDeploymentEvent,
} from "@/lib/deployment/server";
import { getSystemDiagnosticsData } from "@/lib/system/data";
import { getCanonicalAppUrl } from "@/lib/system/env";
import { getFilesBucket, getVideosBucket } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = assertUuid((await context.params).id);
    const { client, user, accessMode } = await requireDeploymentContext(request);
    const { data: release, error: releaseError } = await client
      .from("deployment_releases")
      .select("id,status,deployment_url")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (releaseError) throw new DeploymentRequestError(releaseError.message, 500);
    if (!release) throw new DeploymentRequestError("Deployment release not found.", 404);
    if (release.status === "live" || release.status === "rolled_back") {
      throw new DeploymentRequestError("Completed releases are read-only.", 409);
    }

    const diagnostics = await getSystemDiagnosticsData();
    const systemById = new Map(diagnostics.checks.map((item) => [item.id, item]));
    const updates: Array<{ key: string; status: "pass" | "fail" | "not_run"; detail: string }> = [];
    const requestOrigin = new URL(request.url).origin;
    const healthTarget = normalizeHealthTarget(release.deployment_url);

    updates.push({
      key: "system_check",
      status: diagnostics.overall === "fail" ? "fail" : "pass",
      detail: diagnostics.overall === "fail" ? "System Check has blocking failures." : `System Check result: ${diagnostics.overall}.`,
    });

    if (healthTarget) {
      const publicHealth = await fetchHealth(`${healthTarget}/api/health`);
      updates.push({
        key: "public_health",
        status: publicHealth.ok ? "pass" : "fail",
        detail: `${healthTarget}/api/health — ${publicHealth.detail}`,
      });
    } else {
      updates.push({
        key: "public_health",
        status: "not_run",
        detail: "Add the Vercel deployment URL before running the production health check.",
      });
    }

    const healthSecret = process.env.HEALTH_CHECK_SECRET?.trim();
    const canSendDeepSecret = Boolean(healthTarget && healthSecret && isTrustedDeepHealthTarget(healthTarget, requestOrigin));
    if (healthTarget && healthSecret && canSendDeepSecret) {
      const deepHealth = await fetchHealth(`${healthTarget}/api/health?deep=1`, healthSecret);
      updates.push({
        key: "deep_health",
        status: deepHealth.ok ? "pass" : "fail",
        detail: `${healthTarget}/api/health?deep=1 — ${deepHealth.detail}`,
      });
    } else {
      updates.push({
        key: "deep_health",
        status: "not_run",
        detail: !healthTarget
          ? "Add the Vercel deployment URL before running the deep health check."
          : healthSecret
            ? "Deep health was not called because the release URL is not the current or canonical application host. Run npm run smoke:production with the production secret instead."
            : "HEALTH_CHECK_SECRET is not configured.",
      });
    }

    updates.push({
      key: "broken_links",
      status: diagnostics.storageAudit.missingFiles + diagnostics.storageAudit.missingVideos === 0 ? "pass" : "fail",
      detail: `${diagnostics.storageAudit.missingFiles} missing file object(s), ${diagnostics.storageAudit.missingVideos} missing video object(s).`,
    });
    updates.push({
      key: "assignment_cron",
      status: systemById.get("automation")?.status === "pass" ? "pass" : "fail",
      detail: systemById.get("automation")?.summary ?? "Automation check unavailable.",
    });

    if (accessMode === "secret") {
      const { data: buckets, error: bucketError } = await client.storage.listBuckets();
      const expected = new Set([getFilesBucket(), getVideosBucket()]);
      const requiredBuckets = (buckets ?? []).filter((bucket) => expected.has(bucket.name));
      const privateBuckets = requiredBuckets.length === expected.size && requiredBuckets.every((bucket) => !bucket.public);
      updates.push({
        key: "storage_private",
        status: !bucketError && privateBuckets ? "pass" : "fail",
        detail: bucketError
          ? bucketError.message
          : privateBuckets
            ? "Both required Storage buckets are private."
            : "One or more required buckets are missing or public.",
      });
    }

    const now = new Date().toISOString();
    for (const item of updates) {
      const { error } = await client
        .from("deployment_smoke_tests")
        .update({ status: item.status, detail: item.detail, checked_at: item.status === "not_run" ? null : now })
        .eq("release_id", id)
        .eq("owner_id", user.id)
        .eq("test_key", item.key);
      if (error) throw new DeploymentRequestError(error.message, 422);
    }

    await writeDeploymentEvent(
      client,
      user.id,
      id,
      "automatic_checks_run",
      `Updated ${updates.length} automatic deployment checks.`,
      { target: healthTarget ?? null, checks: updates.map((item) => ({ key: item.key, status: item.status })) },
    );
    return Response.json({ success: true, updated: updates.length, checks: updates });
  } catch (error) {
    return deploymentErrorResponse(error);
  }
}

async function fetchHealth(url: string, bearer?: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json().catch(() => null)) as { status?: string; release?: string; database?: boolean; storage?: boolean } | null;
    const ok = response.ok && payload?.status === "ok";
    const detail = `HTTP ${response.status}, status=${payload?.status ?? "invalid-json"}, release=${payload?.release ?? "unknown"}${payload && "database" in payload ? `, database=${String(payload.database)}, storage=${String(payload.storage)}` : ""}`;
    return { ok, detail };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Health request failed." };
  }
}

function normalizeHealthTarget(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return null;
  }
}

function isTrustedDeepHealthTarget(target: string, requestOrigin: string): boolean {
  if (target === requestOrigin) return true;
  const canonical = getCanonicalAppUrl();
  if (!canonical) return false;
  try {
    return new URL(target).host === new URL(canonical).host;
  } catch {
    return false;
  }
}
