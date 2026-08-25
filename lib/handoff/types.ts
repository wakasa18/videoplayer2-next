export type HandoffItemStatus = "pending" | "pass" | "fail";

export type HandoffChecklistItem = {
  key: string;
  group: "acceptance" | "operations" | "security" | "documentation";
  label: string;
  description: string;
  required: boolean;
  automatic: boolean;
  status: HandoffItemStatus;
  evidence: string | null;
  updatedAt: string | null;
};

export type HandoffReadiness = {
  status: "ready" | "review" | "blocked";
  score: number;
  passed: number;
  pending: number;
  failed: number;
  requiredPassed: number;
  requiredTotal: number;
  blockers: string[];
};

export type HandoffSignoff = {
  id: number;
  status: "accepted" | "reopened";
  acceptedBy: string;
  notes: string | null;
  acceptedAt: string;
};

export type HandoffPageData = {
  release: string;
  generatedAt: string;
  items: HandoffChecklistItem[];
  readiness: HandoffReadiness;
  latestSignoff: HandoffSignoff | null;
};
