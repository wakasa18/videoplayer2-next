import "server-only";

import { redirect } from "next/navigation";

import { getSystemDiagnosticsData } from "@/lib/system/data";
import { createClient } from "@/lib/supabase/server";
import type {
  DeploymentDashboardData,
  DeploymentEvent,
  DeploymentReadiness,
  DeploymentRelease,
  DeploymentSmokeTest,
} from "@/lib/deployment/types";

export async function getDeploymentDashboardData(): Promise<DeploymentDashboardData> {
  const client = await createClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) redirect("/auth/login");

  const releaseResult = await client
    .from("deployment_releases")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (releaseResult.error) {
    throw new Error(
      `${releaseResult.error.message}. Run database/phase9_production_cutover.sql in Supabase SQL Editor.`,
    );
  }

  const release = (releaseResult.data ?? null) as DeploymentRelease | null;
  let tests: DeploymentSmokeTest[] = [];
  let events: DeploymentEvent[] = [];

  if (release) {
    const [testsResult, eventsResult] = await Promise.all([
      client
        .from("deployment_smoke_tests")
        .select("*")
        .eq("owner_id", user.id)
        .eq("release_id", release.id)
        .order("category", { ascending: true })
        .order("id", { ascending: true }),
      client
        .from("deployment_events")
        .select("*")
        .eq("owner_id", user.id)
        .eq("release_id", release.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (testsResult.error) throw new Error(testsResult.error.message);
    if (eventsResult.error) throw new Error(eventsResult.error.message);
    tests = (testsResult.data ?? []) as DeploymentSmokeTest[];
    events = (eventsResult.data ?? []) as DeploymentEvent[];
  }

  const system = await getSystemDiagnosticsData();
  return {
    release,
    tests,
    events,
    system,
    readiness: calculateDeploymentReadiness(system.overall, tests),
  };
}

export function calculateDeploymentReadiness(
  systemStatus: "pass" | "warn" | "fail",
  tests: DeploymentSmokeTest[],
): DeploymentReadiness {
  const required = tests.filter((test) => test.required);
  const optional = tests.filter((test) => !test.required);
  const requiredPassed = required.filter((test) => test.status === "pass").length;
  const optionalPassed = optional.filter((test) => test.status === "pass").length;
  const failedTests = tests.filter((test) => test.status === "fail").length;
  const pendingTests = tests.filter((test) => test.status === "not_run").length;
  const blockers: string[] = [];

  if (systemStatus === "fail") blockers.push("System Check contains one or more failed diagnostics.");
  if (failedTests) blockers.push(`${failedTests} smoke test${failedTests === 1 ? " has" : "s have"} failed.`);
  const missingRequired = required.length - requiredPassed;
  if (missingRequired) blockers.push(`${missingRequired} required smoke test${missingRequired === 1 ? " is" : "s are"} not passed.`);

  return {
    status: systemStatus === "fail" || failedTests ? "fail" : missingRequired || systemStatus === "warn" ? "warn" : "pass",
    requiredPassed,
    requiredTotal: required.length,
    optionalPassed,
    optionalTotal: optional.length,
    failedTests,
    pendingTests,
    canStartDeployment: systemStatus !== "fail" && tests.length > 0,
    canGoLive: systemStatus !== "fail" && required.length > 0 && requiredPassed === required.length && failedTests === 0,
    blockers,
  };
}
