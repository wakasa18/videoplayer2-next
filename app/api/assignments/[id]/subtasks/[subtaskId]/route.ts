import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  getOwnedAssignment,
  parseAssignmentId,
  requireAssignmentWriteContext,
  sanitizeText,
  writeAssignmentAudit,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; subtaskId: string }> },
) {
  try {
    const params = await context.params;
    const assignmentId = parseAssignmentId(params.id);
    const subtaskId = parseChildId(params.subtaskId);
    const { client, user } = await requireAssignmentWriteContext(request);
    const assignment = await getOwnedAssignment(client, assignmentId, user.id, "id,deleted_at,archived_at");
    if (assignment.deleted_at || assignment.archived_at) throw new AssignmentRequestError("Restore this assignment to the active list first.", 409);
    const payload = (await request.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("title" in payload) {
      const title = sanitizeText(payload.title, 255);
      if (!title) throw new AssignmentRequestError("Enter a subtask title.");
      update.title = title;
    }
    if ("isDone" in payload) update.is_done = Boolean(payload.isDone);
    if ("sortOrder" in payload) {
      const sortOrder = Number.parseInt(String(payload.sortOrder), 10);
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100_000) {
        throw new AssignmentRequestError("Invalid subtask order.");
      }
      update.sort_order = sortOrder;
    }

    const { data, error } = await client
      .from("assignment_subtasks")
      .update(update)
      .eq("id", subtaskId)
      .eq("assignment_id", assignmentId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!data) throw new AssignmentRequestError("Subtask not found.", 404);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_subtask_updated", {
      subtask_id: subtaskId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; subtaskId: string }> },
) {
  try {
    const params = await context.params;
    const assignmentId = parseAssignmentId(params.id);
    const subtaskId = parseChildId(params.subtaskId);
    const { client, user } = await requireAssignmentWriteContext(request);
    const assignment = await getOwnedAssignment(client, assignmentId, user.id, "id,deleted_at,archived_at");
    if (assignment.deleted_at || assignment.archived_at) throw new AssignmentRequestError("Restore this assignment to the active list first.", 409);
    const { data, error } = await client
      .from("assignment_subtasks")
      .delete()
      .eq("id", subtaskId)
      .eq("assignment_id", assignmentId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!data) throw new AssignmentRequestError("Subtask not found.", 404);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_subtask_deleted", {
      subtask_id: subtaskId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function parseChildId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) throw new AssignmentRequestError("Invalid subtask identifier.");
  return id;
}
