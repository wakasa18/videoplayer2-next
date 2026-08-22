import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  getOwnedSubjectName,
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
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isInteger(id) || id < 1) throw new AssignmentRequestError("Invalid template identifier.");
    const { client, user } = await requireAssignmentWriteContext(request);
    const { data: template, error } = await client
      .from("assignment_templates")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("is_archived", false)
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!template) throw new AssignmentRequestError("Template not found.", 404);

    const subjectId = template.subject_id ? Number(template.subject_id) : null;
    const subjectName = await getOwnedSubjectName(client, subjectId, user.id);
    const dueDate = addDays(manilaDateKey(), Number(template.due_offset_days ?? 7));
    const recurrence = template.recurrence ? String(template.recurrence) : null;
    const now = new Date().toISOString();
    const { data: assignment, error: insertError } = await client
      .from("assignments")
      .insert({
        owner_id: user.id,
        title: String(template.title),
        description: template.description ?? null,
        due_date: dueDate,
        due_time: template.due_time ?? null,
        status: "to_do",
        priority: template.priority ?? "medium",
        subject_id: subjectId,
        subject: subjectName,
        link_url: template.link_url ?? null,
        recurrence,
        recurrence_series_id: recurrence ? crypto.randomUUID() : null,
        recurrence_until: null,
        occurrence_index: 0,
        template_id: id,
        reminder_minutes_before: Number(template.reminder_minutes_before ?? 1440),
        custom_reminder_at: null,
        reminder_due_at: null,
        reminder_sent_at: null,
        snoozed_until: null,
        completed_at: null,
        archived_at: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insertError) throw new AssignmentRequestError(insertError.message, 422);
    const assignmentId = Number(assignment.id);
    await writeAssignmentAudit(client, user.id, assignmentId, "assignment_created_from_template", {
      template_id: id,
      template_name: template.name,
    });
    return NextResponse.json({ success: true, id: assignmentId }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function manilaDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
