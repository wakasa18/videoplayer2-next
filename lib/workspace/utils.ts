import type {
  WorkspaceActivityFilters,
  WorkspaceActivityModule,
  WorkspaceDefaultModule,
} from "@/lib/workspace/types";

const ACTIVITY_MODULES = new Set<WorkspaceActivityModule>([
  "files",
  "assignments",
  "videos",
  "security",
]);

export const WORKSPACE_DEFAULT_MODULES = new Set<WorkspaceDefaultModule>([
  "home",
  "files",
  "assignments",
  "videos",
  "activity",
]);

export function parseWorkspaceActivityFilters(
  params: Record<string, string | string[] | undefined>,
): WorkspaceActivityFilters {
  const rawModule = first(params.module).trim().toLowerCase();
  const activityModule = ACTIVITY_MODULES.has(rawModule as WorkspaceActivityModule)
    ? (rawModule as WorkspaceActivityModule)
    : "";
  const q = first(params.q).trim().slice(0, 120);
  const page = clampInteger(first(params.page), 1, 100000, 1);
  const perPage = clampInteger(first(params.perPage), 10, 100, 25);
  return { module: activityModule, q, page, perPage };
}

export function buildWorkspaceActivityQuery(
  filters: WorkspaceActivityFilters,
  patch: Partial<WorkspaceActivityFilters>,
): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.module) params.set("module", next.module);
  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.perPage !== 25) params.set("perPage", String(next.perPage));
  const query = params.toString();
  return query ? `/dashboard/activity?${query}` : "/dashboard/activity";
}

export function formatBytes(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (value < 1024) return `${value.toLocaleString()} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount >= 100 ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}

export function formatWorkspaceDateTime(
  value: string | null | undefined,
  timezone = "Asia/Manila",
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
}

export function workspaceActionLabel(action: string): string {
  return action
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function workspaceModuleLabel(module: WorkspaceActivityModule): string {
  if (module === "security") return "Account";
  return module.charAt(0).toUpperCase() + module.slice(1);
}

export function summarizeActivityDetails(
  details: Record<string, unknown>,
): string {
  const preferred = [
    "name",
    "title",
    "original_name",
    "assignment_title",
    "path",
    "from",
    "to",
    "folder",
    "display_name",
  ];

  for (const key of preferred) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 180);
    }
  }

  const visible = Object.entries(details)
    .filter(([key, value]) => {
      if (key === "user_id" || key === "owner_id") return false;
      return ["string", "number", "boolean"].includes(typeof value);
    })
    .slice(0, 3)
    .map(([key, value]) => `${workspaceActionLabel(key)}: ${String(value)}`);

  return visible.join(" · ") || "No additional details";
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function clampInteger(
  raw: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, minimum), maximum);
}
