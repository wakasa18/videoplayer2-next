import { NextResponse } from "next/server";

import { ensureNextOccurrence } from "@/lib/assignments/automation";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  normalizeCompletedAt,
  requireAssignmentWriteContext,
  sanitizeStatus,
  writeAssignmentAudit,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BulkPayload = {
  action?: unknown;
  ids?: unknown;
  status?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as BulkPayload;
    const ids = sanitizeIds(payload.ids);
    const action = String(payload.action ?? "");
    const now = new Date().toISOString();

    if (action === "status") {
      const status = sanitizeStatus(payload.status);
      const { data, error } = await client
        .from("assignments")
        .update({
          status,
          completed_at: normalizeCompletedAt(status),
          updated_at: now,
        })
        .in("id", ids)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .is("archived_at", null)
        .select("id");
      if (error) throw new AssignmentRequestError(error.message, 422);
      const updatedIds = (data ?? []).map((row) => Number(row.id));
      let recurrencesCreated = 0;
      if (status === "done" || status === "submitted") {
        for (const assignmentId of updatedIds) {
          const nextId = await ensureNextOccurrence(client, assignmentId, user.id);
          if (nextId) recurrencesCreated += 1;
        }
      }
      await writeAssignmentAudit(client, user.id, null, "assignments_bulk_status", {
        ids: updatedIds,
        status,
        recurrences_created: recurrencesCreated,
      });
      return NextResponse.json({ success: true, count: data?.length ?? 0, recurrencesCreated });
    }

    if (action === "archive" || action === "trash" || action === "restore") {
      const update =
        action === "archive"
          ? { archived_at: now, updated_at: now }
          : action === "trash"
            ? { deleted_at: now, archived_at: null, updated_at: now }
            : { deleted_at: null, updated_at: now };
      let query = client
        .from("assignments")
        .update(update)
        .in("id", ids)
        .eq("owner_id", user.id);
      if (action === "archive") query = query.is("deleted_at", null);
      if (action === "restore") query = query.not("deleted_at", "is", null);
      const { data, error } = await query.select("id");
      if (error) throw new AssignmentRequestError(error.message, 422);
      await writeAssignmentAudit(client, user.id, null, `assignments_bulk_${action}`, {
        ids: (data ?? []).map((row) => row.id),
      });
      return NextResponse.json({ success: true, count: data?.length ?? 0 });
    }

    if (action === "delete") {
      const { data, error } = await client
        .from("assignments")
        .delete()
        .in("id", ids)
        .eq("owner_id", user.id)
        .not("deleted_at", "is", null)
        .select("id");
      if (error) throw new AssignmentRequestError(error.message, 422);
      await writeAssignmentAudit(client, user.id, null, "assignments_bulk_permanent_delete", {
        ids: (data ?? []).map((row) => row.id),
      });
      return NextResponse.json({ success: true, count: data?.length ?? 0 });
    }

    throw new AssignmentRequestError("Unsupported bulk action.");
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new AssignmentRequestError("Select at least one assignment.");
  }
  const ids = Array.from(
    new Set(
      value
        .map((item) => Number.parseInt(String(item), 10))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
  if (ids.length < 1) throw new AssignmentRequestError("Select at least one assignment.");
  if (ids.length > 200) throw new AssignmentRequestError("Update at most 200 assignments at once.");
  return ids;
}
