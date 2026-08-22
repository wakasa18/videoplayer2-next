export type DiagnosticStatus = "pass" | "warn" | "fail";

export type SystemDiagnostic = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  summary: string;
  detail?: string | null;
};

export type EnvironmentDiagnostic = {
  key: string;
  configured: boolean;
  required: boolean;
  serverOnly: boolean;
  note: string;
};

export type StorageAuditSummary = {
  checkedVideos: number;
  missingVideos: number;
  recoveredVideos: number;
  checkedFiles: number;
  missingFiles: number;
  truncated: boolean;
};

export type SystemErrorLog = {
  id: number;
  source: string;
  message: string;
  path: string | null;
  request_id: string | null;
  created_at: string | null;
};

export type SystemDiagnosticsData = {
  release: string;
  checkedAt: string;
  overall: DiagnosticStatus;
  deployment: {
    environment: string;
    region: string | null;
    commit: string | null;
    appUrl: string | null;
    node: string;
  };
  environment: EnvironmentDiagnostic[];
  checks: SystemDiagnostic[];
  storageAudit: StorageAuditSummary;
  recentErrors: SystemErrorLog[];
};
