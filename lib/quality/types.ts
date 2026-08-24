export type QualityStatus = "pass" | "warn" | "fail" | "skip";

export type QualityCheck = {
  id: string;
  group: "security" | "database" | "storage" | "automation" | "performance" | "accessibility";
  label: string;
  status: QualityStatus;
  summary: string;
  detail?: string | null;
  durationMs: number;
};

export type QualityMetric = {
  name: "CLS" | "FCP" | "INP" | "LCP" | "TTFB";
  samples: number;
  average: number;
  p75: number;
  rating: QualityStatus;
  unit: "ms" | "score";
};

export type QualityReport = {
  release: string;
  generatedAt: string;
  overall: Exclude<QualityStatus, "skip">;
  score: number;
  summary: string;
  counts: {
    pass: number;
    warn: number;
    fail: number;
    skip: number;
  };
  checks: QualityCheck[];
  metrics: QualityMetric[];
  totalDurationMs: number;
};

export type QualityRunHistory = {
  id: number;
  status: Exclude<QualityStatus, "skip">;
  score: number;
  summary: string;
  createdAt: string;
};

export type QualityPageData = {
  report: QualityReport;
  history: QualityRunHistory[];
  persistenceAvailable: boolean;
  persistenceMessage: string | null;
};

export type WebVitalPayload = {
  id: string;
  name: QualityMetric["name"];
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  navigationType?: string | null;
  path?: string | null;
};
