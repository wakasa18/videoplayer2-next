import {
  assertUuid,
  cleanDeploymentText,
  deploymentErrorResponse,
  DeploymentRequestError,
  normalizeDeploymentUrl,
  requireDeploymentContext,
  writeDeploymentEvent,
} from "@/lib/deployment/server";
import type { DeploymentRelease, DeploymentReleaseStatus } from "@/lib/deployment/types";
import { getSystemDiagnosticsData } from "@/lib/system/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRANSITIONS: Record<DeploymentReleaseStatus, DeploymentReleaseStatus[]> = {
  draft: ["ready", "failed"],
  ready: ["draft", "deploying", "failed"],
  deploying: ["ready", "live", "failed", "rolled_back"],
  live: ["rolled_back", "failed"],
  failed: ["ready", "rolled_back"],
  rolled_back: ["ready"],
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = assertUuid((await context.params).id);
    const { client, user } = await requireDeploymentContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new DeploymentRequestError("Invalid release update.");

    const { data: currentData, error: currentError } = await client
      .from("deployment_releases")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (currentError) throw new DeploymentRequestError(currentError.message, 500);
    if (!currentData) throw new DeploymentRequestError("Deployment release not found.", 404);
    const current = currentData as DeploymentRelease;

    const update: Record<string, unknown> = {};
    if ("deploymentUrl" in body) update.deployment_url = normalizeDeploymentUrl(body.deploymentUrl);
    if ("commitSha" in body) update.commit_sha = cleanDeploymentText(body.commitSha, 120) || null;
    if ("notes" in body) update.notes = cleanDeploymentText(body.notes, 5000) || null;

    let nextStatus: DeploymentReleaseStatus | null = null;
    if (body.status !== undefined) {
      nextStatus = normalizeStatus(body.status);
      if (nextStatus !== current.status && !TRANSITIONS[current.status].includes(nextStatus)) {
        throw new DeploymentRequestError(`A ${current.status} release cannot move directly to ${nextStatus}.`, 409);
      }
      if (nextStatus === "ready") {
        const diagnostics = await getSystemDiagnosticsData();
        if (diagnostics.overall === "fail") {
          throw new DeploymentRequestError("Resolve all failed System Check diagnostics before marking the release ready.", 409);
        }
      }
      if (nextStatus === "deploying" && !String(update.deployment_url ?? current.deployment_url ?? "").trim()) {
        throw new DeploymentRequestError("Add the Vercel deployment URL before starting deployment.", 409);
      }
      if (nextStatus === "live") {
        const { data: tests, error: testsError } = await client
          .from("deployment_smoke_tests")
          .select("required,status,label")
          .eq("release_id", id)
          .eq("owner_id", user.id);
        if (testsError) throw new DeploymentRequestError(testsError.message, 500);
        const required = (tests ?? []).filter((test) => test.required);
        const notPassed = required.filter((test) => test.status !== "pass");
        if (!required.length || notPassed.length) {
          throw new DeploymentRequestError(
            `${notPassed.length || "Required"} smoke test${notPassed.length === 1 ? " is" : "s are"} not passed.`,
            409,
          );
        }
        const diagnostics = await getSystemDiagnosticsData();
        if (diagnostics.overall === "fail") {
          throw new DeploymentRequestError("System Check still has blocking failures.", 409);
        }
      }

      update.status = nextStatus;
      const now = new Date().toISOString();
      if (nextStatus === "deploying" && !current.started_at) update.started_at = now;
      if (nextStatus === "live") {
        update.deployed_at = current.deployed_at ?? now;
        update.completed_at = now;
        update.rolled_back_at = null;
      }
      if (nextStatus === "rolled_back") {
        update.rolled_back_at = now;
        update.completed_at = now;
      }
      if (nextStatus === "failed") update.completed_at = now;
      if (nextStatus === "ready" && current.status === "rolled_back") {
        update.started_at = null;
        update.deployed_at = null;
        update.completed_at = null;
        update.rolled_back_at = null;
      }
    }

    if (!Object.keys(update).length) throw new DeploymentRequestError("No release changes were provided.");
    const { data: updatedData, error: updateError } = await client
      .from("deployment_releases")
      .update(update)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("*")
      .single();
    if (updateError || !updatedData) throw new DeploymentRequestError(updateError?.message ?? "Release update failed.", 422);
    const updated = updatedData as DeploymentRelease;

    await writeDeploymentEvent(
      client,
      user.id,
      id,
      nextStatus && nextStatus !== current.status ? "status_changed" : "release_updated",
      nextStatus && nextStatus !== current.status
        ? `Release status changed from ${current.status} to ${nextStatus}.`
        : "Release deployment details were updated.",
      { previous_status: current.status, status: updated.status },
    );

    return Response.json({ success: true, release: updated });
  } catch (error) {
    return deploymentErrorResponse(error);
  }
}

function normalizeStatus(value: unknown): DeploymentReleaseStatus {
  const normalized = String(value ?? "").trim() as DeploymentReleaseStatus;
  if (!["draft", "ready", "deploying", "live", "failed", "rolled_back"].includes(normalized)) {
    throw new DeploymentRequestError("Invalid release status.");
  }
  return normalized;
}
