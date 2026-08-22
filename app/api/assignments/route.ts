import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  getOwnedSubjectName,
  normalizeCompletedAt,
  requireAssignmentWriteContext,
  sanitizeDate,
  sanitizeDateTime,
  sanitizeExternalUrl,
  sanitizeNullableText,
  sanitizePriority,
  sanitizeRecurrence,
  sanitizeRecurrenceUntil,
  sanitizeReminderMinutes,
  sanitizeStatus,
  sanitizeSubjectId,
  sanitizeText,
  sanitizeTime,
  writeAssignmentAudit,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreatePayload = {
  title?: unknown;
  description?: unknown;
  dueDate?: unknown;
  dueTime?: unknown;
  status?: unknown;
  priority?: unknown;
  subjectId?: unknown;
  linkUrl?: unknown;
  reminderMinutesBefore?: unknown;
  customReminderAt?: unknown;
  recurrence?: unknown;
  recurrenceUntil?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as CreatePayload;
    const title = sanitizeText(payload.title, 255);
    if (!title) throw new Error("Enter an assignment title.");

    const status = sanitizeStatus(payload.status ?? "to_do");
    const subjectId = sanitizeSubjectId(payload.subjectId);
    const subjectName = await getOwnedSubjectName(client, subjectId, user.id);
    const now = new Date().toISOString();
    const recurrence = sanitizeRecurrence(payload.recurrence);

    const row = {
      owner_id: user.id,
      title,
      description: sanitizeNullableText(payload.description, 10_000),
      due_date: sanitizeDate(payload.dueDate),
      due_time: sanitizeTime(payload.dueTime),
      status,
      priority: sanitizePriority(payload.priority ?? "medium"),
      subject_id: subjectId,
      subject: subjectName,
      link_url: sanitizeExternalUrl(payload.linkUrl),
      reminder_minutes_before: sanitizeReminderMinutes(payload.reminderMinutesBefore),
      custom_reminder_at: sanitizeDateTime(payload.customReminderAt),
      recurrence,
      recurrence_series_id: recurrence ? crypto.randomUUID() : null,
      recurrence_until: recurrence ? sanitizeRecurrenceUntil(payload.recurrenceUntil) : null,
      occurrence_index: 0,
      reminder_due_at: null,
      reminder_sent_at: null,
      snoozed_until: null,
      completed_at: normalizeCompletedAt(status),
      archived_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await client
      .from("assignments")
      .insert(row)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const id = Number(data.id);
    await writeAssignmentAudit(client, user.id, id, "assignment_created", {
      title,
      status,
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
