import { NextResponse } from "next/server";

import { normalizeNote } from "@/lib/notes/data";
import {
  getOwnedNote,
  noteErrorResponse,
  NoteRequestError,
  requireNoteContext,
  sanitizeColor,
  sanitizeContent,
  sanitizeReminder,
  sanitizeTitle,
} from "@/lib/notes/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  title?: unknown;
  content?: unknown;
  color?: unknown;
  isPinned?: unknown;
  reminderAt?: unknown;
  archived?: unknown;
};

function noteId(value: string) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) throw new NoteRequestError("Invalid note id.");
  return id;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const id = noteId(idParam);
    const { client, user } = await requireNoteContext(request);
    const current = await getOwnedNote(client, user.id, id);
    const payload = (await request.json()) as UpdatePayload;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(payload, "title")) updates.title = sanitizeTitle(payload.title);
    if (Object.prototype.hasOwnProperty.call(payload, "content")) updates.content = sanitizeContent(payload.content);
    if (Object.prototype.hasOwnProperty.call(payload, "color")) updates.color = sanitizeColor(payload.color);
    if (Object.prototype.hasOwnProperty.call(payload, "isPinned")) updates.is_pinned = Boolean(payload.isPinned);
    if (Object.prototype.hasOwnProperty.call(payload, "archived")) {
      updates.archived_at = Boolean(payload.archived) ? new Date().toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "reminderAt")) {
      const reminder = sanitizeReminder(payload.reminderAt);
      updates.reminder_at = reminder;
      if (reminder !== current.reminder_at) updates.reminder_sent_at = null;
    }

    const { data, error } = await client
      .from("workspace_notes")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id,owner_id,title,content,color,is_pinned,reminder_at,reminder_sent_at,archived_at,deleted_at,created_at,updated_at")
      .single();
    if (error) throw new NoteRequestError(error.message, 422);
    return NextResponse.json({ note: normalizeNote(data as Record<string, unknown>) });
  } catch (error) {
    return noteErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const id = noteId(idParam);
    const { client, user } = await requireNoteContext(request);
    await getOwnedNote(client, user.id, id);
    const { error } = await client
      .from("workspace_notes")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new NoteRequestError(error.message, 422);
    return NextResponse.json({ success: true });
  } catch (error) {
    return noteErrorResponse(error);
  }
}
