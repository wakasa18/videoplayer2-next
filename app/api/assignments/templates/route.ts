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

type TemplatePayload = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  recurrence?: unknown;
  subjectId?: unknown;
  dueTime?: unknown;
  dueOffsetDays?: unknown;
  reminderMinutesBefore?: unknown;
  linkUrl?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as TemplatePayload;
    const name = sanitizeText(payload.name, 100);
    const title = sanitizeText(payload.title, 255);
    if (!name || !title) {
      throw new AssignmentRequestError("Enter a template name and assignment title.");
    }
    const subjectId = sanitizeSubjectId(payload.subjectId);
    await getOwnedSubjectName(client, subjectId, user.id);
    const now = new Date().toISOString();
    const row = {
      owner_id: user.id,
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
      is_archived: false,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await client
      .from("assignment_templates")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new AssignmentRequestError(error.message, error.code === "23505" ? 409 : 422);
    return NextResponse.json({ success: true, id: Number(data.id) }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function sanitizeDueOffset(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "7"), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3650) {
    throw new AssignmentRequestError("Due offset must be between 0 and 3,650 days.");
  }
  return parsed;
}
