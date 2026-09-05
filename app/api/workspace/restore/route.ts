import { NextResponse } from "next/server";

import { requireWorkspaceWriteContext, workspaceErrorResponse, writeWorkspaceSecurityEvent } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Backup = Record<string, unknown> & {
  schema?: unknown;
  version?: unknown;
  account?: { user_id?: unknown };
  profile?: Record<string, unknown> | null;
  important_files?: Array<Record<string, unknown>> | null;
  important_folders?: Array<Record<string, unknown>> | null;
  assignments?: Array<Record<string, unknown>> | null;
  assignment_subjects?: Array<Record<string, unknown>> | null;
};

export async function POST(request: Request) {
  try {
    const { client, user } = await requireWorkspaceWriteContext(request);
    const body = await request.json() as { backup?: Backup; filename?: unknown; mode?: unknown };
    const backup = body.backup;
    if (!backup || typeof backup !== "object") throw new Error("Choose a valid Damon’s Archive JSON backup.");
    const schema = String(backup.schema ?? "");
    const version = Number(backup.version ?? 0);
    if (!schema.startsWith("damons-archive-") || !Number.isInteger(version) || version < 1 || version > 5) throw new Error("This JSON file is not a supported Damon’s Archive metadata backup.");
    if (backup.account?.user_id && String(backup.account.user_id) !== user.id) throw new Error("This backup belongs to a different account and cannot be restored here.");
    const mode = String(body.mode ?? "validate") === "merge" ? "merge" : "validate";
    const filename = String(body.filename ?? "metadata-backup.json").slice(0, 255);
    const counts = {
      folders: Array.isArray(backup.important_folders) ? backup.important_folders.length : 0,
      files: Array.isArray(backup.important_files) ? backup.important_files.length : 0,
      subjects: Array.isArray(backup.assignment_subjects) ? backup.assignment_subjects.length : 0,
      assignments: Array.isArray(backup.assignments) ? backup.assignments.length : 0,
    };

    const { data: run, error: runError } = await client.from("workspace_restore_runs").insert({ owner_id: user.id, source_filename: filename, backup_schema: schema.slice(0, 160), backup_version: version, mode, status: "running", summary: { counts }, created_at: new Date().toISOString() }).select("id").single();
    if (runError) throw new Error(runError.message);

    if (mode === "validate") {
      await client.from("workspace_restore_runs").update({ status: "pass", summary: { counts, note: "Validation only; no records were changed." }, completed_at: new Date().toISOString() }).eq("id", run.id).eq("owner_id", user.id);
      return NextResponse.json({ success: true, mode, counts, message: "Backup is valid for this account. No data was changed." });
    }

    const updated = { profile: 0, folders: 0, files: 0, subjects: 0, assignments: 0 };
    const now = new Date().toISOString();

    if (backup.profile && typeof backup.profile === "object") {
      const profile = backup.profile;
      const allowed = {
        display_name: textOrNull(profile.display_name, 120),
        timezone: textOrNull(profile.timezone, 80),
        week_starts_on: Number.isInteger(Number(profile.week_starts_on)) ? Number(profile.week_starts_on) : undefined,
        default_module: textOrNull(profile.default_module, 30),
        compact_mode: typeof profile.compact_mode === "boolean" ? profile.compact_mode : undefined,
        updated_at: now,
      };
      const cleaned = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
      const { error } = await client.from("workspace_profiles").update(cleaned).eq("owner_id", user.id);
      if (!error) updated.profile = 1;
    }

    for (const row of (backup.important_folders ?? []).slice(0, 5000)) {
      const id = Number(row.id);
      if (!Number.isInteger(id)) continue;
      const update = { name: textOrNull(row.name, 255), path: textOrNull(row.path, 1200), parent_path: textOrNull(row.parent_path, 1200), updated_at: now };
      const { data } = await client.from("important_folders").update(update).eq("id", id).eq("owner_id", user.id).select("id");
      if (data?.length) updated.folders += 1;
    }

    for (const row of (backup.important_files ?? []).slice(0, 10000)) {
      const id = Number(row.id);
      if (!Number.isInteger(id)) continue;
      const update = {
        title: textOrNull(row.title, 255), description: textOrNull(row.description, 5000), category: textOrNull(row.category, 100), folder_path: textOrNull(row.folder_path, 1200),
        document_date: dateOrNull(row.document_date), is_favorite: Boolean(row.is_favorite), updated_at: now,
      };
      const { data } = await client.from("important_files").update(update).eq("id", id).eq("owner_id", user.id).select("id");
      if (data?.length) updated.files += 1;
    }

    for (const row of (backup.assignment_subjects ?? []).slice(0, 1000)) {
      const id = Number(row.id);
      if (!Number.isInteger(id)) continue;
      const update = { name: textOrNull(row.name, 255), code: textOrNull(row.code, 100), instructor: textOrNull(row.instructor, 255), color: textOrNull(row.color, 50), schedule: textOrNull(row.schedule, 500), semester: textOrNull(row.semester, 100), is_archived: Boolean(row.is_archived), updated_at: now };
      const { data } = await client.from("assignment_subjects").update(update).eq("id", id).eq("owner_id", user.id).select("id");
      if (data?.length) updated.subjects += 1;
    }

    for (const row of (backup.assignments ?? []).slice(0, 10000)) {
      const id = Number(row.id);
      if (!Number.isInteger(id)) continue;
      const update = {
        title: textOrNull(row.title, 255), description: textOrNull(row.description, 10_000), due_date: dateOrNull(row.due_date), due_time: timeOrNull(row.due_time),
        link_url: textOrNull(row.link_url, 500), reminder_minutes_before: safeInteger(row.reminder_minutes_before, 0, 525600), custom_reminder_at: dateTimeOrNull(row.custom_reminder_at), updated_at: now,
      };
      const cleaned = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));
      const { data } = await client.from("assignments").update(cleaned).eq("id", id).eq("owner_id", user.id).select("id");
      if (data?.length) updated.assignments += 1;
    }

    await client.from("workspace_restore_runs").update({ status: "pass", summary: { counts, updated, note: "Safe metadata merge only. Storage bytes, credentials, and deleted records were not recreated." }, completed_at: new Date().toISOString() }).eq("id", run.id).eq("owner_id", user.id);
    await writeWorkspaceSecurityEvent(client, user.id, "workspace_metadata_restored", { filename, schema, version, updated });
    return NextResponse.json({ success: true, mode, counts, updated, message: "Safe metadata merge completed. Existing matching records were updated; private Storage objects were not replaced." });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

function textOrNull(value: unknown, max: number) { if (value === null || value === undefined || value === "") return null; return String(value).trim().slice(0, max) || null; }
function dateOrNull(value: unknown) { const text = textOrNull(value, 10); return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; }
function timeOrNull(value: unknown) { const text = textOrNull(value, 8); return text && /^\d{2}:\d{2}(:\d{2})?$/.test(text) ? text : null; }
function dateTimeOrNull(value: unknown) { const text = textOrNull(value, 60); if (!text) return null; const date = new Date(text); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function safeInteger(value: unknown, min: number, max: number) { const number = Number(value); return Number.isInteger(number) && number >= min && number <= max ? number : undefined; }
