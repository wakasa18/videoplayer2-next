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

export async function GET(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const { data, error } = await client
      .from("assignment_subjects")
      .select("id,name,code,instructor,color,schedule,semester,is_archived")
      .eq("owner_id", user.id)
      .order("is_archived")
      .order("name");
    if (error) throw new AssignmentRequestError(error.message, 422);
    return NextResponse.json({ subjects: data ?? [] });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const payload = (await request.json()) as Record<string, unknown>;
    const name = sanitizeText(payload.name, 100);
    if (!name) throw new AssignmentRequestError("Enter a subject name.");
    const color = sanitizeColor(payload.color);
    const now = new Date().toISOString();

    const { data, error } = await client
      .from("assignment_subjects")
      .insert({
        owner_id: user.id,
        name,
        code: sanitizeNullableText(payload.code, 30),
        instructor: sanitizeNullableText(payload.instructor, 100),
        color,
        schedule: sanitizeNullableText(payload.schedule, 255),
        semester: sanitizeNullableText(payload.semester, 100),
        is_archived: false,
        created_at: now,
        updated_at: now,
      })
      .select("id,name,code,instructor,color,schedule,semester,is_archived")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new AssignmentRequestError("A subject with this name already exists.", 409);
      }
      throw new AssignmentRequestError(error.message, 422);
    }
    await writeAssignmentAudit(client, user.id, null, "assignment_subject_created", {
      subject_id: data.id,
      name,
    });
    return NextResponse.json({ success: true, subject: data }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function sanitizeColor(value: unknown): string {
  const color = sanitizeText(value, 7) || "#1a73e8";
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new AssignmentRequestError("Select a valid subject color.");
  }
  return color;
}
