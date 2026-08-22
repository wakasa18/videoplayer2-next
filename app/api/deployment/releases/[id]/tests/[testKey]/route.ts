import {
  assertUuid,
  cleanDeploymentText,
  deploymentErrorResponse,
  DeploymentRequestError,
  requireDeploymentContext,
  writeDeploymentEvent,
} from "@/lib/deployment/server";
import type { DeploymentTestStatus } from "@/lib/deployment/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; testKey: string }> },
) {
  try {
    const params = await context.params;
    const releaseId = assertUuid(params.id);
    const testKey = cleanDeploymentText(decodeURIComponent(params.testKey), 100);
    if (!testKey) throw new DeploymentRequestError("Smoke-test key is required.");
    const { client, user } = await requireDeploymentContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new DeploymentRequestError("Invalid smoke-test update.");
    const status = normalizeTestStatus(body.status);
    const detail = cleanDeploymentText(body.detail, 5000) || null;

    const { data: release, error: releaseError } = await client
      .from("deployment_releases")
      .select("id,status")
      .eq("id", releaseId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (releaseError) throw new DeploymentRequestError(releaseError.message, 500);
    if (!release) throw new DeploymentRequestError("Deployment release not found.", 404);
    if (release.status === "live" || release.status === "rolled_back") {
      throw new DeploymentRequestError("Completed releases are read-only. Create a new release for another cutover.", 409);
    }

    const checkedAt = status === "not_run" ? null : new Date().toISOString();
    const { data: testData, error: updateError } = await client
      .from("deployment_smoke_tests")
      .update({ status, detail, checked_at: checkedAt })
      .eq("release_id", releaseId)
      .eq("owner_id", user.id)
      .eq("test_key", testKey)
      .select("*")
      .maybeSingle();
    if (updateError) throw new DeploymentRequestError(updateError.message, 422);
    if (!testData) throw new DeploymentRequestError("Smoke test not found.", 404);

    await writeDeploymentEvent(
      client,
      user.id,
      releaseId,
      "smoke_test_updated",
      `${testData.label}: ${status.replace("_", " ")}.`,
      { test_key: testKey, status, detail },
    );
    return Response.json({ success: true, test: testData });
  } catch (error) {
    return deploymentErrorResponse(error);
  }
}

function normalizeTestStatus(value: unknown): DeploymentTestStatus {
  const normalized = String(value ?? "").trim() as DeploymentTestStatus;
  if (!["not_run", "pass", "fail", "skipped"].includes(normalized)) {
    throw new DeploymentRequestError("Invalid smoke-test status.");
  }
  return normalized;
}
