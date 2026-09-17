export type NoteColor = "violet" | "blue" | "emerald" | "amber" | "rose" | "slate";

export type WorkspaceNote = {
  id: number;
  owner_id?: string | null;
  title: string;
  content: string;
  color: NoteColor;
  is_pinned: boolean;
  reminder_at: string | null;
  reminder_sent_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotesData = {
  notes: WorkspaceNote[];
  tableAvailable: boolean;
};
