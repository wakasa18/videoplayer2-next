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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const assignmentId = parseAssignmentId((await context.params).id);
    const { client, user } = await requireAssignmentWriteContext(request);
    const assignment = await getOwnedAssignment(client, assignmentId, user.id, "id,deleted_at,archived_at");
    if (assignment.deleted_at || assignment.archived_at) throw new AssignmentRequestError("Restore this assignment to the active list first.", 409);
    const payload = (await request.json()) as Record<string, unknown>;
    const content = sanitizeText(payload.content, 20_000);
    if (!content) throw new AssignmentRequestError("Enter a note.");
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("assignment_notes")
      .insert({
        owner_id: user.id,
        assignment_id: assignmentId,
        content,
        is_pinned: Boolean(payload.isPinned),
        created_at: now,
        updated_at: now,
      })
      .select("id,assignment_id,content,is_pinned,created_at,updated_at")
      .single();
    if (error) throw new AssignmentRequestError(error.message, 422);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_note_created", {
      note_id: data.id,
    });
    return NextResponse.json({ success: true, note: data }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
