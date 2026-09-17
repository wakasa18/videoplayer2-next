import { NextResponse } from "next/server";

import {
  noteErrorResponse,
  requireNoteContext,
  sanitizeColor,
  sanitizeContent,
  sanitizeReminder,
  sanitizeTitle,
} from "@/lib/notes/server";
import { normalizeNote } from "@/lib/notes/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateNotePayload = {
  title?: unknown;
  content?: unknown;
  color?: unknown;
  isPinned?: unknown;
  reminderAt?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user } = await requireNoteContext(request);
    const payload = (await request.json()) as CreateNotePayload;
    const now = new Date().toISOString();
    const row = {
      owner_id: user.id,
      title: sanitizeTitle(payload.title),
      content: sanitizeContent(payload.content),
      color: sanitizeColor(payload.color),
      is_pinned: Boolean(payload.isPinned),
      reminder_at: sanitizeReminder(payload.reminderAt),
      reminder_sent_at: null,
      archived_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await client
      .from("workspace_notes")
      .insert(row)
      .select("id,owner_id,title,content,color,is_pinned,reminder_at,reminder_sent_at,archived_at,deleted_at,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ note: normalizeNote(data as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    return noteErrorResponse(error);
  }
}
