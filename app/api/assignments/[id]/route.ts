import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  getOwnedAssignment,
  getOwnedSubjectName,
  normalizeCompletedAt,
  parseAssignmentId,
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
import { ensureNextOccurrence } from "@/lib/assignments/automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AssignmentPatchPayload =
  | {
      action: "metadata";
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
    }
  | { action: "status"; status?: unknown }
  | { action: "archive" }
  | { action: "unarchive" }
  | { action: "trash" }
  | { action: "restore" };

export async function PATCH(
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
      "id,title,status,completed_at,archived_at,deleted_at,recurrence,recurrence_series_id",
    );
    const payload = (await request.json()) as AssignmentPatchPayload;
    const now = new Date().toISOString();

    if (payload.action === "metadata") {
      if (assignment.deleted_at || assignment.archived_at) {
        throw new AssignmentRequestError("Restore this assignment to the active list before editing it.", 409);
      }
      const title = sanitizeText(payload.title, 255);
      if (!title) throw new AssignmentRequestError("Enter an assignment title.");
      const status = sanitizeStatus(payload.status ?? assignment.status ?? "to_do");
      const subjectId = sanitizeSubjectId(payload.subjectId);
      const subjectName = await getOwnedSubjectName(client, subjectId, user.id);
      const recurrence = sanitizeRecurrence(payload.recurrence);
      const recurrenceSeriesId = recurrence
        ? String(assignment.recurrence_series_id || crypto.randomUUID())
        : null;

      const update = {
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
        recurrence_series_id: recurrenceSeriesId,
        recurrence_until: recurrence ? sanitizeRecurrenceUntil(payload.recurrenceUntil) : null,
        reminder_due_at: null,
        reminder_sent_at: null,
        snoozed_until: null,
        completed_at: normalizeCompletedAt(status, assignment.completed_at ?? null),
        updated_at: now,
      };

      const { error } = await client
        .from("assignments")
        .update(update)
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new AssignmentRequestError(error.message, 422);

      await writeAssignmentAudit(client, user.id, id, "assignment_updated", {
        title,
        status,
        recurrence,
      });
      const nextOccurrenceId =
        status === "done" || status === "submitted"
          ? await ensureNextOccurrence(client, id, user.id)
          : null;
      return NextResponse.json({ success: true, nextOccurrenceId });
    }

    if (payload.action === "status") {
      if (assignment.deleted_at || assignment.archived_at) {
        throw new AssignmentRequestError("Restore this assignment before changing its status.", 409);
      }
      const status = sanitizeStatus(payload.status);
      const { error } = await client
        .from("assignments")
        .update({
          status,
          completed_at: normalizeCompletedAt(status, assignment.completed_at ?? null),
          updated_at: now,
        })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new AssignmentRequestError(error.message, 422);
      await writeAssignmentAudit(client, user.id, id, "assignment_status_changed", { status });
      const nextOccurrenceId =
        status === "done" || status === "submitted"
          ? await ensureNextOccurrence(client, id, user.id)
          : null;
      return NextResponse.json({ success: true, status, nextOccurrenceId });
    }

    if (payload.action === "archive") {
      if (assignment.deleted_at) {
        throw new AssignmentRequestError("Restore this assignment before archiving it.", 409);
      }
      const { error } = await client
        .from("assignments")
        .update({ archived_at: now, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new AssignmentRequestError(error.message, 422);
      await writeAssignmentAudit(client, user.id, id, "assignment_archived");
      return NextResponse.json({ success: true });
    }

    if (payload.action === "unarchive") {
      if (!assignment.archived_at || assignment.deleted_at) {
        throw new AssignmentRequestError("Archived assignment not found.", 409);
      }
      const { error } = await client
        .from("assignments")
        .update({ archived_at: null, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new AssignmentRequestError(error.message, 422);
      await writeAssignmentAudit(client, user.id, id, "assignment_unarchived");
      return NextResponse.json({ success: true });
    }

    if (payload.action === "trash") {
      if (assignment.deleted_at) {
        throw new AssignmentRequestError("This assignment is already in the Recycle Bin.", 409);
      }
      const { error } = await client
        .from("assignments")
        .update({ deleted_at: now, archived_at: null, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new AssignmentRequestError(error.message, 422);
      await writeAssignmentAudit(client, user.id, id, "assignment_recycled");
      return NextResponse.json({ success: true });
    }

    if (payload.action === "restore") {
      if (!assignment.deleted_at) {
        throw new AssignmentRequestError("This assignment is not in the Recycle Bin.", 409);
      }
      const { error } = await client
        .from("assignments")
        .update({ deleted_at: null, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw new AssignmentRequestError(error.message, 422);
      await writeAssignmentAudit(client, user.id, id, "assignment_restored");
      return NextResponse.json({ success: true });
    }

    throw new AssignmentRequestError("Unsupported assignment action.");
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function DELETE(
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
      "id,title,deleted_at",
    );
    if (!assignment.deleted_at) {
      throw new AssignmentRequestError(
        "Move the assignment to the Recycle Bin before permanently deleting it.",
        409,
      );
    }

    const { error } = await client
      .from("assignments")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .not("deleted_at", "is", null);
    if (error) throw new AssignmentRequestError(error.message, 422);

    await writeAssignmentAudit(client, user.id, null, "assignment_permanently_deleted", {
      deleted_assignment_id: id,
      title: assignment.title,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
