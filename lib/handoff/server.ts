import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HandoffChecklistItem,
  HandoffItemStatus,
  HandoffPageData,
  HandoffReadiness,
} from "@/lib/handoff/types";

export const PHASE12_RELEASE = "phase-12-final-handoff";

const MANUAL_ITEMS: Omit<HandoffChecklistItem, "status" | "evidence" | "updatedAt">[] = [
  { key: "uat-auth", group: "acceptance", label: "Authentication flow accepted", description: "Login, logout, password reset, and session expiry were tested in production.", required: true, automatic: false },
  { key: "uat-files", group: "acceptance", label: "Files workflow accepted", description: "Upload, folder, preview, rename, move, download, recycle, and restore were tested.", required: true, automatic: false },
  { key: "uat-shares", group: "acceptance", label: "Public sharing accepted", description: "Shared files and folders were tested for preview, ZIP download, expiration, and access limits.", required: true, automatic: false },
  { key: "uat-assignments", group: "acceptance", label: "Assignments workflow accepted", description: "Assignment creation, reminders, subtasks, notes, attachments, and completion were tested.", required: true, automatic: false },
  { key: "uat-videos", group: "acceptance", label: "Video workflow accepted", description: "Video upload, playback, seeking, download, and missing-object recovery were tested.", required: true, automatic: false },
  { key: "restore-rehearsal", group: "operations", label: "Backup restore rehearsal completed", description: "A metadata backup was downloaded, verified, and a documented restore rehearsal was completed.", required: true, automatic: false },
  { key: "rollback-rehearsal", group: "operations", label: "Vercel rollback verified", description: "A previous successful deployment can be promoted or restored if a release fails.", required: true, automatic: false },
  { key: "secrets-reviewed", group: "security", label: "Production secrets reviewed", description: "Vercel production variables are complete and no secret is stored in Git or a shared archive.", required: true, automatic: false },
  { key: "permissions-reviewed", group: "security", label: "RLS and Storage permissions reviewed", description: "Owner-scoped RLS and private Storage buckets were tested with an authenticated account.", required: true, automatic: false },
  { key: "manual-reviewed", group: "documentation", label: "User and administrator guides reviewed", description: "The final manuals, troubleshooting guide, and operational schedule are understood by the system owner.", required: true, automatic: false },
  { key: "support-owner", group: "documentation", label: "Support ownership assigned", description: "A person is assigned to backups, monitoring, updates, incident response, and user support.", required: true, automatic: false },
];

export async function collectHandoffData(
  client: SupabaseClient,
  ownerId: string,
): Promise<HandoffPageData> {
  const [quality, maintenance, deployment, backup, savedItems, signoff] = await Promise.all([
    client.from("quality_runs").select("status,score,summary,created_at").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("maintenance_runs").select("status,summary,created_at").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("deployment_releases").select("status,deployment_url,release_tag,updated_at").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("backup_verifications").select("status,filename,verified_at").eq("owner_id", ownerId).order("verified_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("handoff_acceptance_items").select("item_key,status,evidence,updated_at").eq("owner_id", ownerId),
    client.from("handoff_acceptance_runs").select("id,status,accepted_by,notes,accepted_at").eq("owner_id", ownerId).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const tableError = savedItems.error ?? signoff.error;
  if (tableError) throw new Error(`${tableError.message}. Run database/phase12_acceptance_handoff.sql.`);

  const automatic: HandoffChecklistItem[] = [
    autoItem("qa-ready", "acceptance", "Phase 11 QA is release-ready", "The latest automated QA run must have no failed checks.", quality.data?.status === "pass" ? "pass" : quality.data?.status === "warn" ? "pending" : "fail", quality.data ? `Score ${quality.data.score}/100 · ${quality.data.summary}` : "No saved QA run found."),
    autoItem("maintenance-ready", "operations", "Maintenance review is healthy", "The latest maintenance run must not be critical.", maintenance.data?.status === "healthy" ? "pass" : maintenance.data?.status === "attention" ? "pending" : "fail", maintenance.data?.summary ?? "No maintenance run found."),
    autoItem("deployment-live", "operations", "Production release is live", "The latest deployment release must be marked live.", deployment.data?.status === "live" ? "pass" : deployment.data ? "pending" : "fail", deployment.data ? `${deployment.data.release_tag} · ${deployment.data.deployment_url ?? "URL not recorded"}` : "No deployment release found."),
    autoItem("backup-verified", "operations", "Recent backup is verified", "At least one metadata backup must pass verification.", backup.data?.status === "pass" ? "pass" : backup.data?.status === "warn" ? "pending" : "fail", backup.data ? `${backup.data.filename} · ${backup.data.status}` : "No backup verification found."),
  ];

  const saved = new Map((savedItems.data ?? []).map((row) => [String(row.item_key), row]));
  const manual = MANUAL_ITEMS.map((item): HandoffChecklistItem => {
    const row = saved.get(item.key);
    return {
      ...item,
      status: normalizeStatus(row?.status),
      evidence: typeof row?.evidence === "string" ? row.evidence : null,
      updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
    };
  });
  const items = [...automatic, ...manual];

  return {
    release: PHASE12_RELEASE,
    generatedAt: new Date().toISOString(),
    items,
    readiness: calculateReadiness(items),
    latestSignoff: signoff.data
      ? {
          id: Number(signoff.data.id),
          status: signoff.data.status === "reopened" ? "reopened" : "accepted",
          acceptedBy: String(signoff.data.accepted_by ?? "System owner"),
          notes: typeof signoff.data.notes === "string" ? signoff.data.notes : null,
          acceptedAt: String(signoff.data.accepted_at),
        }
      : null,
  };
}

export async function updateHandoffItem(
  client: SupabaseClient,
  ownerId: string,
  itemKey: string,
  status: HandoffItemStatus,
  evidence: string | null,
) {
  if (!MANUAL_ITEMS.some((item) => item.key === itemKey)) throw new Error("Unknown acceptance item.");
  const { error } = await client.from("handoff_acceptance_items").upsert(
    { owner_id: ownerId, item_key: itemKey, status, evidence: evidence?.slice(0, 2000) || null, updated_at: new Date().toISOString() },
    { onConflict: "owner_id,item_key" },
  );
  if (error) throw new Error(error.message);
}

export async function saveSignoff(
  client: SupabaseClient,
  ownerId: string,
  data: HandoffPageData,
  acceptedBy: string,
  notes: string | null,
): Promise<number> {
  if (data.readiness.status !== "ready") throw new Error("Complete all required acceptance items before final sign-off.");
  const { data: row, error } = await client
    .from("handoff_acceptance_runs")
    .insert({ owner_id: ownerId, release: PHASE12_RELEASE, status: "accepted", accepted_by: acceptedBy.slice(0, 160), notes: notes?.slice(0, 4000) || null, readiness: data.readiness, checklist: data.items })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return Number(row.id);
}

export function calculateReadiness(items: HandoffChecklistItem[]): HandoffReadiness {
  const required = items.filter((item) => item.required);
  const passed = items.filter((item) => item.status === "pass").length;
  const pending = items.filter((item) => item.status === "pending").length;
  const failed = items.filter((item) => item.status === "fail").length;
  const requiredPassed = required.filter((item) => item.status === "pass").length;
  const blockers = required.filter((item) => item.status !== "pass").map((item) => item.label);
  return {
    status: failed ? "blocked" : blockers.length ? "review" : "ready",
    score: Math.round((passed / Math.max(1, items.length)) * 100),
    passed,
    pending,
    failed,
    requiredPassed,
    requiredTotal: required.length,
    blockers,
  };
}

function autoItem(key: string, group: HandoffChecklistItem["group"], label: string, description: string, status: HandoffItemStatus, evidence: string): HandoffChecklistItem {
  return { key, group, label, description, required: true, automatic: true, status, evidence, updatedAt: new Date().toISOString() };
}

function normalizeStatus(value: unknown): HandoffItemStatus {
  return value === "pass" || value === "fail" ? value : "pending";
}
