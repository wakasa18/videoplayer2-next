import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  requireAssignmentWriteContext,
  sanitizeNullableText,
  sanitizeText,
  writeAssignmentAudit,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  try {
    const subjectId = parseId((await context.params).subjectId);
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "metadata");
    const now = new Date().toISOString();

    if (action === "archive" || action === "restore") {
      const isArchived = action === "archive";
      const { data, error } = await client
        .from("assignment_subjects")
        .update({ is_archived: isArchived, updated_at: now })
        .eq("id", subjectId)
        .eq("owner_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw new AssignmentRequestError(error.message, 422);
      if (!data) throw new AssignmentRequestError("Subject not found.", 404);
      await writeAssignmentAudit(client, user.id, null, `assignment_subject_${action}d`, {
        subject_id: subjectId,
      });
      return NextResponse.json({ success: true });
    }

    const name = sanitizeText(payload.name, 100);
    if (!name) throw new AssignmentRequestError("Enter a subject name.");
    const color = sanitizeColor(payload.color);
    const { data, error } = await client
      .from("assignment_subjects")
      .update({
        name,
        code: sanitizeNullableText(payload.code, 30),
        instructor: sanitizeNullableText(payload.instructor, 100),
        color,
        schedule: sanitizeNullableText(payload.schedule, 255),
        semester: sanitizeNullableText(payload.semester, 100),
        updated_at: now,
      })
      .eq("id", subjectId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw new AssignmentRequestError("A subject with this name already exists.", 409);
      }
      throw new AssignmentRequestError(error.message, 422);
    }
    if (!data) throw new AssignmentRequestError("Subject not found.", 404);

    await client
      .from("assignments")
      .update({ subject: name, updated_at: now })
      .eq("subject_id", subjectId)
      .eq("owner_id", user.id);

    await writeAssignmentAudit(client, user.id, null, "assignment_subject_updated", {
      subject_id: subjectId,
      name,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  try {
    const subjectId = parseId((await context.params).subjectId);
    const { client, user } = await requireAssignmentWriteContext(request);
    const { count, error: countError } = await client
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subjectId)
      .eq("owner_id", user.id)
      .is("deleted_at", null);
    if (countError) throw new AssignmentRequestError(countError.message, 422);
    if ((count ?? 0) > 0) {
      throw new AssignmentRequestError(
        "Archive this subject instead. It is still used by assignments.",
        409,
      );
    }
    const { data, error } = await client
      .from("assignment_subjects")
      .delete()
      .eq("id", subjectId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AssignmentRequestError(error.message, 422);
    if (!data) throw new AssignmentRequestError("Subject not found.", 404);
    await writeAssignmentAudit(client, user.id, null, "assignment_subject_deleted", {
      subject_id: subjectId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function parseId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new AssignmentRequestError("Invalid subject identifier.");
  }
  return id;
}

function sanitizeColor(value: unknown): string {
  const color = sanitizeText(value, 7) || "#1a73e8";
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new AssignmentRequestError("Select a valid subject color.");
  }
  return color;
}
