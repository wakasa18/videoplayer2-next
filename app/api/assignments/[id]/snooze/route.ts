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
    const id = parseAssignmentId((await context.params).id);
    const { client, user } = await requireAssignmentWriteContext(request);
    const assignment = await getOwnedAssignment(
      client,
      id,
      user.id,
      "id,title,status,archived_at,deleted_at",
    );
    if (assignment.archived_at || assignment.deleted_at) {
      throw new AssignmentRequestError("Restore this assignment before snoozing its reminder.", 409);
    }
    if (["done", "submitted"].includes(String(assignment.status))) {
      throw new AssignmentRequestError("Completed assignments do not need reminder snoozing.", 409);
    }

    const payload = (await request.json()) as { minutes?: unknown; until?: unknown };
    let until: Date;
    if (payload.until) {
      until = new Date(String(payload.until));
      if (Number.isNaN(until.getTime())) throw new AssignmentRequestError("Invalid snooze date.");
    } else {
      const minutes = Number.parseInt(String(payload.minutes ?? "60"), 10);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 43_200) {
        throw new AssignmentRequestError("Snooze time must be between 5 minutes and 30 days.");
      }
      until = new Date(Date.now() + minutes * 60_000);
    }
    if (until.getTime() <= Date.now()) {
      throw new AssignmentRequestError("Choose a future snooze time.");
    }

    const { error } = await client
      .from("assignments")
      .update({
        snoozed_until: until.toISOString(),
        reminder_sent_at: null,
        reminder_due_at: until.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new AssignmentRequestError(error.message, 422);

    await writeAssignmentAudit(client, user.id, id, "assignment_reminder_snoozed", {
      snoozed_until: until.toISOString(),
    });
    return NextResponse.json({ success: true, snoozedUntil: until.toISOString() });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
