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
    const title = sanitizeText(payload.title, 255);
    if (!title) throw new AssignmentRequestError("Enter a subtask title.");

    const { data: last } = await client
      .from("assignment_subtasks")
      .select("sort_order")
      .eq("assignment_id", assignmentId)
      .eq("owner_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();
    const { data, error } = await client
      .from("assignment_subtasks")
      .insert({
        owner_id: user.id,
        assignment_id: assignmentId,
        title,
        is_done: false,
        sort_order: Number(last?.sort_order ?? -1) + 1,
        created_at: now,
        updated_at: now,
      })
      .select("id,assignment_id,title,is_done,sort_order,created_at,updated_at")
      .single();
    if (error) throw new AssignmentRequestError(error.message, 422);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_subtask_created", {
      subtask_id: data.id,
      title,
    });
    return NextResponse.json({ success: true, subtask: data }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
