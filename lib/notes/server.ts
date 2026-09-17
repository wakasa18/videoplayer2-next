import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import type { NoteColor, WorkspaceNote } from "@/lib/notes/types";
import { normalizeNote } from "@/lib/notes/data";

const COLORS = new Set<NoteColor>(["violet", "blue", "emerald", "amber", "rose", "slate"]);

export class NoteRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "NoteRequestError";
    this.status = status;
  }
}

export async function requireNoteContext(request: Request): Promise<{ client: SupabaseClient; user: User }> {
  assertSameOrigin(request);
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();
  if (error || !user) throw new NoteRequestError("Authentication required.", 401);
  return { client: createAdminClient() ?? sessionClient, user };
}

export function noteErrorResponse(error: unknown) {
  const status = error instanceof NoteRequestError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected notes error.";
  return NextResponse.json({ error: message }, { status });
}

export function sanitizeTitle(value: unknown) {
  const title = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new NoteRequestError("Enter a note title.");
  if (title.length > 180) throw new NoteRequestError("Note title must be 180 characters or less.");
  return title;
}

export function sanitizeContent(value: unknown) {
  const content = String(value ?? "");
  if (content.length > 50_000) throw new NoteRequestError("Note content must be 50,000 characters or less.");
  return content;
}

export function sanitizeColor(value: unknown): NoteColor {
  const color = String(value ?? "violet") as NoteColor;
  return COLORS.has(color) ? color : "violet";
}

export function sanitizeReminder(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new NoteRequestError("Select a valid reminder date and time.");
  return date.toISOString();
}

export async function getOwnedNote(client: SupabaseClient, ownerId: string, id: number): Promise<WorkspaceNote> {
  const { data, error } = await client
    .from("workspace_notes")
    .select("id,owner_id,title,content,color,is_pinned,reminder_at,reminder_sent_at,archived_at,deleted_at,created_at,updated_at")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new NoteRequestError(error.message, 422);
  if (!data) throw new NoteRequestError("Note not found.", 404);
  return normalizeNote(data as Record<string, unknown>);
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const url = new URL(request.url);
  if (new URL(origin).host !== url.host) throw new NoteRequestError("Invalid request origin.", 403);
}
