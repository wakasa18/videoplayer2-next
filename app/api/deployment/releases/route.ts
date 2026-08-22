import { PHASE9_SMOKE_TESTS } from "@/lib/deployment/checklist";
import {
  cleanDeploymentText,
  deploymentErrorResponse,
  DeploymentRequestError,
  normalizeDeploymentUrl,
  requireDeploymentContext,
  writeDeploymentEvent,
} from "@/lib/deployment/server";
import type { DeploymentEnvironment, DeploymentRelease } from "@/lib/deployment/types";
import { PHASE9_RELEASE } from "@/lib/system/release";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { client, user } = await requireDeploymentContext(request);
    const { data, error } = await client
      .from("deployment_releases")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new DeploymentRequestError(error.message, 500);
    return Response.json({ releases: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return deploymentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireDeploymentContext(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const { data: activeRelease, error: activeError } = await client
      .from("deployment_releases")
      .select("id,release_tag,status")
      .eq("owner_id", user.id)
      .in("status", ["draft", "ready", "deploying"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeError) throw new DeploymentRequestError(activeError.message, 500);
    if (activeRelease) {
      throw new DeploymentRequestError(
        `Release ${activeRelease.release_tag} is still ${activeRelease.status}. Finish or roll it back before creating another release.`,
        409,
      );
    }

    const releaseTag =
      cleanDeploymentText(body.releaseTag, 80) ||
      `phase9-${PHASE9_RELEASE}-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
    const environment = normalizeEnvironment(body.environment);
    const deploymentUrl = normalizeDeploymentUrl(body.deploymentUrl);
    const commitSha = cleanDeploymentText(body.commitSha, 120) || null;
    const notes = cleanDeploymentText(body.notes, 5000) || null;

    const { data: releaseData, error: releaseError } = await client
      .from("deployment_releases")
      .insert({
        owner_id: user.id,
        release_tag: releaseTag,
        environment,
        status: "draft",
        deployment_url: deploymentUrl,
        commit_sha: commitSha,
        notes,
      })
      .select("*")
      .single();
    if (releaseError || !releaseData) {
      throw new DeploymentRequestError(
        `${releaseError?.message ?? "Release could not be created."} Run database/phase9_production_cutover.sql.`,
        422,
      );
    }
    const release = releaseData as DeploymentRelease;

    const smokeRows = PHASE9_SMOKE_TESTS.map((test) => ({
      owner_id: user.id,
      release_id: release.id,
      test_key: test.key,
      category: test.category,
      label: test.label,
      required: test.required,
      status: "not_run",
    }));
    const { error: testsError } = await client.from("deployment_smoke_tests").insert(smokeRows);
    if (testsError) {
      await client.from("deployment_releases").delete().eq("id", release.id).eq("owner_id", user.id);
      throw new DeploymentRequestError(testsError.message, 422);
    }

    await writeDeploymentEvent(
      client,
      user.id,
      release.id,
      "release_created",
      `Created ${release.release_tag} for ${release.environment}.`,
      { deployment_url: deploymentUrl, commit_sha: commitSha },
    );

    return Response.json({ success: true, release }, { status: 201 });
  } catch (error) {
    return deploymentErrorResponse(error);
  }
}

function normalizeEnvironment(value: unknown): DeploymentEnvironment {
  return String(value ?? "production").trim() === "preview" ? "preview" : "production";
}
