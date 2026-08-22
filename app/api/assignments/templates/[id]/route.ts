import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  getOwnedSubjectName,
  requireAssignmentWriteContext,
  sanitizeExternalUrl,
  sanitizeNullableText,
  sanitizePriority,
  sanitizeRecurrence,
  sanitizeReminderMinutes,
  sanitizeSubjectId,
  sanitizeText,
  sanitizeTime,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as Record<string, unknown>;
    const name = sanitizeText(payload.name, 100);
    const title = sanitizeText(payload.title, 255);
    if (!name || !title) throw new AssignmentRequestError("Enter a template name and title.");
    const subjectId = sanitizeSubjectId(payload.subjectId);
    await getOwnedSubjectName(client, subjectId, user.id);
    const { data, error } = await client
      .from("assignment_templates")
      .update({
        name,
        title,
        description: sanitizeNullableText(payload.description, 10_000),
        priority: sanitizePriority(payload.priority ?? "medium"),
        recurrence: sanitizeRecurrence(payload.recurrence),
        subject_id: subjectId,
        due_time: sanitizeTime(payload.dueTime),
        due_offset_days: sanitizeDueOffset(payload.dueOffsetDays),
        reminder_minutes_before: sanitizeReminderMinutes(payload.reminderMinutesBefore),
        link_url: sanitizeExternalUrl(payload.linkUrl),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, error.code === "23505" ? 409 : 422);
    if (!data) throw new AssignmentRequestError("Template not found.", 404);
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
    const id = parseId((await context.params).id);
    const { client, user } = await requireAssignmentWriteContext(request);
    const { error } = await client
      .from("assignment_templates")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new AssignmentRequestError(error.message, 422);
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function parseId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) throw new AssignmentRequestError("Invalid template identifier.");
  return id;
}

function sanitizeDueOffset(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "7"), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3650) {
    throw new AssignmentRequestError("Due offset must be between 0 and 3,650 days.");
  }
  return parsed;
}
