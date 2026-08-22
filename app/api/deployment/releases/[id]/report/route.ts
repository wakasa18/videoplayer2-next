import {
  assertUuid,
  deploymentErrorResponse,
  DeploymentRequestError,
  requireDeploymentContext,
} from "@/lib/deployment/server";
import { calculateDeploymentReadiness } from "@/lib/deployment/data";
import { getSystemDiagnosticsData } from "@/lib/system/data";
import type { DeploymentEvent, DeploymentRelease, DeploymentSmokeTest } from "@/lib/deployment/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = assertUuid((await context.params).id);
    const { client, user } = await requireDeploymentContext(request);
    const [releaseResult, testsResult, eventsResult, system] = await Promise.all([
      client.from("deployment_releases").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle(),
      client.from("deployment_smoke_tests").select("*").eq("release_id", id).eq("owner_id", user.id).order("id"),
      client.from("deployment_events").select("*").eq("release_id", id).eq("owner_id", user.id).order("created_at", { ascending: true }),
      getSystemDiagnosticsData(),
    ]);
    if (releaseResult.error) throw new DeploymentRequestError(releaseResult.error.message, 500);
    if (!releaseResult.data) throw new DeploymentRequestError("Deployment release not found.", 404);
    if (testsResult.error) throw new DeploymentRequestError(testsResult.error.message, 500);
    if (eventsResult.error) throw new DeploymentRequestError(eventsResult.error.message, 500);

    const release = releaseResult.data as DeploymentRelease;
    const tests = (testsResult.data ?? []) as DeploymentSmokeTest[];
    const events = (eventsResult.data ?? []) as DeploymentEvent[];
    const report = {
      schema: "damons-archive-phase9-deployment-report",
      version: 1,
      generated_at: new Date().toISOString(),
      release,
      readiness: calculateDeploymentReadiness(system.overall, tests),
      system: {
        release: system.release,
        checked_at: system.checkedAt,
        overall: system.overall,
        deployment: system.deployment,
        checks: system.checks,
        storage_audit: system.storageAudit,
      },
      smoke_tests: tests,
      events,
      note: "This report contains deployment metadata and test results. It does not contain authentication secrets or private Storage objects.",
    };
    const safeTag = release.release_tag.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80);
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="deployment-report-${safeTag}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return deploymentErrorResponse(error);
  }
}
