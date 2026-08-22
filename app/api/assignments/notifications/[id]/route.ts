import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  requireAssignmentWriteContext,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isInteger(id) || id < 1) {
      throw new AssignmentRequestError("Invalid notification identifier.");
    }
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as { read?: unknown };
    const { data, error } = await client
      .from("assignment_notifications")
      .update({ read_at: Boolean(payload.read) ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!data) throw new AssignmentRequestError("Notification not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isInteger(id) || id < 1) {
      throw new AssignmentRequestError("Invalid notification identifier.");
    }
    const { client, user } = await requireAssignmentWriteContext(request);
    const { error } = await client
      .from("assignment_notifications")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new AssignmentRequestError(error.message, 422);
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
