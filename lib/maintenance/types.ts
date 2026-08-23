export type MaintenanceStatus = "healthy" | "attention" | "critical";

export type MaintenanceTiming = {
  label: string;
  milliseconds: number;
  status: "fast" | "review" | "slow";
};

export type MaintenanceCleanup = {
  staleFilesDeleted: number;
  staleVideosDeleted: number;
  oldErrorsDeleted: number;
  expiredRateLimitsDeleted: number;
};

export type MaintenanceReport = {
  release: string;
  generatedAt: string;
  status: MaintenanceStatus;
  summary: string;
  storage: {
    activeFiles: number;
    activeVideos: number;
    fileBytes: number;
    videoBytes: number;
    totalBytes: number;
    quotaBytes: number;
    quotaPercent: number;
    missingFiles: number;
    missingVideos: number;
    sampledObjects: number;
  };
  records: {
    pendingFiles: number;
    pendingVideos: number;
    stalePendingFiles: number;
    stalePendingVideos: number;
    errors24h: number;
    errors7d: number;
    errors30d: number;
  };
  configuration: {
    serverSecret: boolean;
    cronSecret: boolean;
    rateLimitFunction: boolean;
    errorRetentionDays: number;
  };
  timings: MaintenanceTiming[];
  warnings: string[];
  cleanup?: MaintenanceCleanup;
};

export type MaintenanceRun = {
  id: string;
  run_type: "manual" | "cron" | "cleanup";
  status: MaintenanceStatus;
  summary: string;
  report: MaintenanceReport | Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type BackupVerification = {
  id: number;
  filename: string;
  schema_name: string | null;
  backup_version: number | null;
  status: "pass" | "warn" | "fail";
  counts: Record<string, number>;
  warnings: string[];
  verified_at: string;
};

export type MaintenanceDashboardData = {
  checkedAt: string;
  current: MaintenanceReport;
  recentRuns: MaintenanceRun[];
  backupVerifications: BackupVerification[];
};
