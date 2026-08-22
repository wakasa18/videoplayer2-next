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
    const fileId = Number.parseInt(String(payload.fileId ?? ""), 10);
    if (!Number.isInteger(fileId) || fileId < 1) {
      throw new AssignmentRequestError("Select a valid Important File.");
    }
    const { data: file, error: fileError } = await client
      .from("important_files")
      .select("id")
      .eq("id", fileId)
      .eq("owner_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (fileError) throw new AssignmentRequestError(fileError.message, 422);
    if (!file) throw new AssignmentRequestError("Important File not found.", 404);

    const { error } = await client.from("assignment_file_links").upsert(
      {
        owner_id: user.id,
        assignment_id: assignmentId,
        important_file_id: fileId,
        created_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,important_file_id", ignoreDuplicates: true },
    );
    if (error) throw new AssignmentRequestError(error.message, 422);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_file_linked", {
      important_file_id: fileId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
