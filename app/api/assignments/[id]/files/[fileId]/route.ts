import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  getOwnedAssignment,
  parseAssignmentId,
  requireAssignmentWriteContext,
  writeAssignmentAudit,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const params = await context.params;
    const assignmentId = parseAssignmentId(params.id);
    const fileId = Number.parseInt(params.fileId, 10);
    if (!Number.isInteger(fileId) || fileId < 1) {
      throw new AssignmentRequestError("Invalid file identifier.");
    }
    const { client, user } = await requireAssignmentWriteContext(request);
    const assignment = await getOwnedAssignment(client, assignmentId, user.id, "id,deleted_at,archived_at");
    if (assignment.deleted_at || assignment.archived_at) throw new AssignmentRequestError("Restore this assignment to the active list first.", 409);
    const { data, error } = await client
      .from("assignment_file_links")
      .delete()
      .eq("assignment_id", assignmentId)
      .eq("important_file_id", fileId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!data) throw new AssignmentRequestError("Linked file not found.", 404);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_file_unlinked", {
      important_file_id: fileId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
