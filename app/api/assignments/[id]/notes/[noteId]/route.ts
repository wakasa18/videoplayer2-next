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
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  try {
    const params = await context.params;
    const assignmentId = parseAssignmentId(params.id);
    const noteId = parseChildId(params.noteId);
    const { client, user } = await requireAssignmentWriteContext(request);
    const assignment = await getOwnedAssignment(client, assignmentId, user.id, "id,deleted_at,archived_at");
    if (assignment.deleted_at || assignment.archived_at) throw new AssignmentRequestError("Restore this assignment to the active list first.", 409);
    const payload = (await request.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("content" in payload) {
      const content = sanitizeText(payload.content, 20_000);
      if (!content) throw new AssignmentRequestError("Enter a note.");
      update.content = content;
    }
    if ("isPinned" in payload) update.is_pinned = Boolean(payload.isPinned);

    const { data, error } = await client
      .from("assignment_notes")
      .update(update)
      .eq("id", noteId)
      .eq("assignment_id", assignmentId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!data) throw new AssignmentRequestError("Note not found.", 404);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_note_updated", {
      note_id: noteId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  try {
    const params = await context.params;
    const assignmentId = parseAssignmentId(params.id);
    const noteId = parseChildId(params.noteId);
    const { client, user } = await requireAssignmentWriteContext(request);
    const assignment = await getOwnedAssignment(client, assignmentId, user.id, "id,deleted_at,archived_at");
    if (assignment.deleted_at || assignment.archived_at) throw new AssignmentRequestError("Restore this assignment to the active list first.", 409);
    const { data, error } = await client
      .from("assignment_notes")
      .delete()
      .eq("id", noteId)
      .eq("assignment_id", assignmentId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!data) throw new AssignmentRequestError("Note not found.", 404);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_note_deleted", {
      note_id: noteId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function parseChildId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) throw new AssignmentRequestError("Invalid note identifier.");
  return id;
}
