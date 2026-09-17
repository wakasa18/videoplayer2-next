import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { NoteColor, NotesData, WorkspaceNote } from "@/lib/notes/types";

const NOTE_COLORS = new Set<NoteColor>(["violet", "blue", "emerald", "amber", "rose", "slate"]);

export async function getNotesData(): Promise<NotesData> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await client
    .from("workspace_notes")
    .select("id,owner_id,title,content,color,is_pinned,reminder_at,reminder_sent_at,archived_at,deleted_at,created_at,updated_at")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return { notes: [], tableAvailable: false };
    }
    throw new Error(error.message);
  }

  return {
    notes: (data ?? []).map((row) => normalizeNote(row as Record<string, unknown>)),
    tableAvailable: true,
  };
}

export function normalizeNote(row: Record<string, unknown>): WorkspaceNote {
  const color = String(row.color ?? "violet") as NoteColor;
  return {
    id: Number(row.id),
    owner_id: row.owner_id ? String(row.owner_id) : null,
    title: String(row.title ?? "Untitled note"),
    content: String(row.content ?? ""),
    color: NOTE_COLORS.has(color) ? color : "violet",
    is_pinned: Boolean(row.is_pinned),
    reminder_at: row.reminder_at ? String(row.reminder_at) : null,
    reminder_sent_at: row.reminder_sent_at ? String(row.reminder_sent_at) : null,
    archived_at: row.archived_at ? String(row.archived_at) : null,
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
    created_at: String(row.created_at ?? new Date(0).toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date(0).toISOString()),
  };
}
