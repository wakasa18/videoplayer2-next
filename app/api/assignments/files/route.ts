import { NextResponse } from "next/server";

import {
  assignmentErrorResponse,
  AssignmentRequestError,
  requireAssignmentWriteContext,
} from "@/lib/assignments/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { client, user } = await requireAssignmentWriteContext(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    let query = client
      .from("important_files")
      .select("id,title,original_filename,mime_type,file_size,status")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (q) query = query.or(`title.ilike.%${escapeFilter(q)}%,original_filename.ilike.%${escapeFilter(q)}%`);
    const { data, error } = await query;
    if (error) throw new AssignmentRequestError(error.message, 422);
    return NextResponse.json({ files: data ?? [] });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function escapeFilter(value: string): string {
  return value.replace(/[%,()]/g, "");
}
