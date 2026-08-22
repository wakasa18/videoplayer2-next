import type { DiagnosticStatus, SystemDiagnosticsData } from "@/lib/system/types";

export type DeploymentReleaseStatus =
  | "draft"
  | "ready"
  | "deploying"
  | "live"
  | "failed"
  | "rolled_back";

export type DeploymentEnvironment = "preview" | "production";
export type DeploymentTestStatus = "not_run" | "pass" | "fail" | "skipped";

export type DeploymentRelease = {
  id: string;
  owner_id: string;
  release_tag: string;
  environment: DeploymentEnvironment;
  status: DeploymentReleaseStatus;
  deployment_url: string | null;
  commit_sha: string | null;
  notes: string | null;
  started_at: string | null;
  deployed_at: string | null;
  completed_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeploymentSmokeTest = {
  id: number;
  release_id: string;
  owner_id: string;
  test_key: string;
  category: string;
  label: string;
  required: boolean;
  status: DeploymentTestStatus;
  detail: string | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeploymentEvent = {
  id: number;
  release_id: string;
  owner_id: string;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DeploymentReadiness = {
  status: DiagnosticStatus;
  requiredPassed: number;
  requiredTotal: number;
  optionalPassed: number;
  optionalTotal: number;
  failedTests: number;
  pendingTests: number;
  canStartDeployment: boolean;
  canGoLive: boolean;
  blockers: string[];
};

export type DeploymentDashboardData = {
  release: DeploymentRelease | null;
  tests: DeploymentSmokeTest[];
  events: DeploymentEvent[];
  system: SystemDiagnosticsData;
  readiness: DeploymentReadiness;
};
