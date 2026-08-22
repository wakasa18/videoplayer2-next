import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceQuotaBytes } from "@/lib/workspace/server";
import type {
  WorkspaceActivityFilters,
  WorkspaceActivityItem,
  WorkspaceActivityResult,
  WorkspaceProfile,
  WorkspaceSettingsData,
  WorkspaceSummary,
} from "@/lib/workspace/types";

const EMPTY_SUMMARY: WorkspaceSummary = {
  file_count: 0,
  file_recycle_count: 0,
  file_bytes: 0,
  video_count: 0,
  video_recycle_count: 0,
  video_bytes: 0,
  assignment_count: 0,
  active_share_count: 0,
  total_bytes: 0,
};

export async function getWorkspaceSettingsData(): Promise<WorkspaceSettingsData> {
  const client = await createClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) redirect("/auth/login");

  const [profileResult, summaryResult] = await Promise.all([
    client
      .from("workspace_profiles")
      .select(
        "owner_id,display_name,timezone,week_starts_on,default_module,compact_mode,created_at,updated_at",
      )
      .eq("owner_id", user.id)
      .maybeSingle(),
    client.rpc("get_workspace_summary"),
  ]);

  if (profileResult.error) {
    throw new Error(
      `${profileResult.error.message}. Run database/phase7_workspace_finalization.sql.`,
    );
  }
  if (summaryResult.error) {
    throw new Error(
      `${summaryResult.error.message}. Run database/phase7_workspace_finalization.sql after Phases 1-6.`,
    );
  }

  const email = user.email ?? "Account";
  const profile = normalizeProfile(
    profileResult.data,
    user.id,
    email.split("@")[0] || "Account",
  );

  return {
    email,
    profile,
    summary: normalizeSummary(summaryResult.data),
    quotaBytes: getWorkspaceQuotaBytes(),
  };
}

export async function getWorkspaceActivity(
  filters: WorkspaceActivityFilters,
): Promise<WorkspaceActivityResult> {
  const client = await createClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) redirect("/auth/login");

  const offset = (filters.page - 1) * filters.perPage;
  const { data, error } = await client.rpc("get_workspace_activity", {
    p_module: filters.module || null,
    p_query: filters.q || null,
    p_limit: filters.perPage,
    p_offset: offset,
  });

  if (error) {
    throw new Error(
      `${error.message}. Run database/phase7_workspace_finalization.sql.`,
    );
  }

  const items = ((data ?? []) as unknown as WorkspaceActivityItem[]).map(
    normalizeActivity,
  );
  const totalItems = Number(items[0]?.total_count ?? 0) || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.perPage));

  return {
    items,
    filters,
    totalItems,
    totalPages,
    page: Math.min(filters.page, totalPages),
  };
}

export async function getWorkspaceSummarySafe(): Promise<WorkspaceSummary> {
  const client = await createClient();
  const { data, error } = await client.rpc("get_workspace_summary");
  return error ? EMPTY_SUMMARY : normalizeSummary(data);
}

function normalizeProfile(
  value: unknown,
  ownerId: string,
  fallbackName: string,
): WorkspaceProfile {
  const row = (value ?? {}) as Partial<WorkspaceProfile>;
  return {
    owner_id: ownerId,
    display_name:
      typeof row.display_name === "string" && row.display_name.trim()
        ? row.display_name.trim()
        : fallbackName,
    timezone:
      typeof row.timezone === "string" && row.timezone.trim()
        ? row.timezone
        : "Asia/Manila",
    week_starts_on: Number.isInteger(Number(row.week_starts_on))
      ? Number(row.week_starts_on)
      : 1,
    default_module: row.default_module ?? "home",
    compact_mode: Boolean(row.compact_mode),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function normalizeSummary(value: unknown): WorkspaceSummary {
  const row = (value ?? {}) as Partial<Record<keyof WorkspaceSummary, unknown>>;
  return {
    file_count: numberValue(row.file_count),
    file_recycle_count: numberValue(row.file_recycle_count),
    file_bytes: numberValue(row.file_bytes),
    video_count: numberValue(row.video_count),
    video_recycle_count: numberValue(row.video_recycle_count),
    video_bytes: numberValue(row.video_bytes),
    assignment_count: numberValue(row.assignment_count),
    active_share_count: numberValue(row.active_share_count),
    total_bytes: numberValue(row.total_bytes),
  };
}

function normalizeActivity(item: WorkspaceActivityItem): WorkspaceActivityItem {
  return {
    ...item,
    target_id: item.target_id == null ? null : Number(item.target_id),
    details:
      item.details && typeof item.details === "object" ? item.details : {},
    total_count: Number(item.total_count) || 0,
  };
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}
