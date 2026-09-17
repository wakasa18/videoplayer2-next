"use client";

import {
  Archive,
  BellRing,
  CalendarClock,
  Clock3,
  Edit3,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "@/components/ui/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ModalPortal } from "@/components/ui/modal-portal";
import type { NoteColor, WorkspaceNote } from "@/lib/notes/types";
import { showNotice, confirmAction } from "@/components/ui/confirm-dialog";

type Filter = "all" | "pinned" | "reminders" | "archived";

const colorStyles: Record<NoteColor, { dot: string; wash: string; ring: string }> = {
  violet: { dot: "bg-primary", wash: "from-primary/[.16]", ring: "border-primary/20" },
  blue: { dot: "bg-sky-400", wash: "from-sky-500/[.13]", ring: "border-sky-300/20" },
  emerald: { dot: "bg-emerald-400", wash: "from-emerald-500/[.12]", ring: "border-emerald-300/20" },
  amber: { dot: "bg-amber-400", wash: "from-amber-500/[.13]", ring: "border-amber-300/20" },
  rose: { dot: "bg-rose-400", wash: "from-rose-500/[.13]", ring: "border-rose-300/20" },
  slate: { dot: "bg-slate-400", wash: "from-slate-400/[.10]", ring: "border-slate-300/15" },
};

export function NotesBoard({
  initialNotes,
  openNew = false,
  focusId = 0,
  initialQuery = "",
}: {
  initialNotes: WorkspaceNote[];
  openNew?: boolean;
  focusId?: number;
  initialQuery?: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState(initialQuery);
  const [editorOpen, setEditorOpen] = useState(openNew || focusId > 0);
  const [editing, setEditing] = useState<WorkspaceNote | null>(
    focusId ? initialNotes.find((note) => note.id === focusId) ?? null : null,
  );
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const activeNotes = notes.filter((note) => !note.archived_at);
  const reminderNotes = activeNotes.filter((note) => note.reminder_at);
  const upcoming = reminderNotes.filter((note) => new Date(note.reminder_at!).getTime() >= now);
  const overdue = reminderNotes.filter(
    (note) => !note.reminder_sent_at && new Date(note.reminder_at!).getTime() < now,
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (filter === "archived") return Boolean(note.archived_at);
        if (note.archived_at) return false;
        if (filter === "pinned" && !note.is_pinned) return false;
        if (filter === "reminders" && !note.reminder_at) return false;
        return true;
      })
      .filter((note) => !normalized || `${note.title} ${note.content}`.toLowerCase().includes(normalized))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at));
  }, [filter, notes, query]);

  function createNote() {
    setEditing(null);
    setEditorOpen(true);
  }

  function editNote(note: WorkspaceNote) {
    setEditing(note);
    setEditorOpen(true);
  }

  async function patchNote(id: number, body: Record<string, unknown>) {
    const response = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { note?: WorkspaceNote; error?: string };
    if (!response.ok || !payload.note) throw new Error(payload.error || "Could not update the note.");
    setNotes((items) => items.map((item) => (item.id === id ? payload.note! : item)));
    return payload.note;
  }

  async function togglePin(note: WorkspaceNote) {
    try {
      await patchNote(note.id, { isPinned: !note.is_pinned });
    } catch (error) {
      (await showNotice(error instanceof Error ? error.message : "Could not update the note."));
    }
  }

  async function toggleArchive(note: WorkspaceNote) {
    try {
      await patchNote(note.id, { archived: !note.archived_at });
    } catch (error) {
      (await showNotice(error instanceof Error ? error.message : "Could not update the note."));
    }
  }

  async function deleteNote(note: WorkspaceNote) {
    if (!(await confirmAction(`Delete “${note.title}”?`))) return;
    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete the note.");
      setNotes((items) => items.filter((item) => item.id !== note.id));
    } catch (error) {
      (await showNotice(error instanceof Error ? error.message : "Could not delete the note."));
    }
  }

  async function runReminderCheck() {
    if (checking) return;
    setChecking(true);
    try {
      const response = await fetch("/api/assignments/automation", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not check reminders.");
      window.dispatchEvent(new Event("damons:refresh-notifications"));
    } catch (error) {
      (await showNotice(error instanceof Error ? error.message : "Could not check reminders."));
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="space-y-5">
      <section className="tech-panel relative overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="tech-scanline" />
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/[.08] px-3 py-1.5 text-xs font-semibold text-primary">
              <StickyNote className="size-4" /> Personal notes
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-.035em] text-slate-100 sm:text-4xl">Notes</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Capture ideas, pin important notes, and schedule reminders that appear in your workspace notification bell.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runReminderCheck} disabled={checking} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-slate-100 disabled:opacity-60">
              {checking ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />} Check reminders
            </button>
            <button type="button" onClick={createNote} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white">
              <Plus className="size-4" /> New note
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active notes" value={activeNotes.length} icon={StickyNote} />
        <StatCard label="Pinned" value={activeNotes.filter((note) => note.is_pinned).length} icon={Pin} />
        <StatCard label="Upcoming reminders" value={upcoming.length} icon={CalendarClock} />
        <StatCard label="Reminder due" value={overdue.length} icon={BellRing} danger={overdue.length > 0} />
      </div>

      <section className="tech-panel rounded-[24px] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "pinned", "reminders", "archived"] as Filter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                aria-pressed={filter === item}
                className={`min-h-10 rounded-lg px-4 text-xs font-semibold capitalize ${filter === item ? "text-primary" : "text-slate-400"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes..."
              className="min-h-11 w-full rounded-lg border border-white/10 bg-white/[.035] pl-11 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary/35 focus:ring-4 focus:ring-primary/10"
            />
          </label>
        </div>
      </section>

      {visible.length ? (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => editNote(note)}
              onPin={() => void togglePin(note)}
              onArchive={() => void toggleArchive(note)}
              onDelete={() => void deleteNote(note)}
              nowMs={now}
            />
          ))}
        </section>
      ) : (
        <section className="tech-card grid min-h-64 place-items-center rounded-[26px] p-8 text-center">
          <div>
            <StickyNote className="mx-auto size-9 text-primary/70" />
            <h2 className="mt-4 text-lg font-semibold text-slate-100">No notes here yet</h2>
            <p className="mt-2 text-sm text-slate-500">Create a note or change the current filter.</p>
            <button type="button" onClick={createNote} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white">
              <Plus className="size-4" /> Create note
            </button>
          </div>
        </section>
      )}

      <NoteEditor
        key={`${editorOpen ? "open" : "closed"}:${editing?.id ?? "new"}`}
        open={editorOpen}
        note={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={(note) => {
          setNotes((items) => {
            const exists = items.some((item) => item.id === note.id);
            return exists ? items.map((item) => (item.id === note.id ? note : item)) : [note, ...items];
          });
          setEditorOpen(false);
        }}
      />
    </main>
  );
}

function NoteCard({ note, onEdit, onPin, onArchive, onDelete, nowMs }: { note: WorkspaceNote; onEdit: () => void; onPin: () => void; onArchive: () => void; onDelete: () => void; nowMs: number }) {
  const palette = colorStyles[note.color];
  const reminderState = getReminderState(note, nowMs);
  return (
    <article className={`tech-card tech-interactive relative overflow-hidden rounded-[24px] border ${palette.ring} p-5`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${palette.wash} via-transparent to-transparent opacity-70`} />
      <div className="relative">
        <div className="flex items-start gap-3">
          <span className={`mt-1 size-2.5 shrink-0 rounded-lg ${palette.dot}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-slate-100">{note.title}</h2>
              {note.is_pinned ? <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-primary">Pinned</span> : null}
              {note.archived_at ? <span className="rounded-lg bg-slate-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">Archived</span> : null}
            </div>
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-slate-400">{note.content || "No content yet."}</p>
          </div>
        </div>

        {note.reminder_at ? (
          <div className={`mt-4 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${reminderState.className}`}>
            <Clock3 className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{reminderState.label} · {formatDateTime(note.reminder_at)}</span>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[.07] pt-3">
          <span className="text-[10px] text-slate-600">Updated {formatRelative(note.updated_at, nowMs)}</span>
          <div className="flex items-center gap-1">
            <IconButton label={note.is_pinned ? "Unpin note" : "Pin note"} onClick={onPin}>{note.is_pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}</IconButton>
            <IconButton label="Edit note" onClick={onEdit}><Edit3 className="size-4" /></IconButton>
            <IconButton label={note.archived_at ? "Restore note" : "Archive note"} onClick={onArchive}><Archive className="size-4" /></IconButton>
            <IconButton label="Delete note" onClick={onDelete} danger><Trash2 className="size-4" /></IconButton>
          </div>
        </div>
      </div>
    </article>
  );
}

function NoteEditor({ open, note, onClose, onSaved }: { open: boolean; note: WorkspaceNote | null; onClose: () => void; onSaved: (note: WorkspaceNote) => void }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [color, setColor] = useState<NoteColor>(note?.color ?? "violet");
  const [reminder, setReminder] = useState(toManilaInput(note?.reminder_at ?? null));
  const [pinned, setPinned] = useState(note?.is_pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <NoteEditorInner
      open={open}
      note={note}
      title={title}
      setTitle={setTitle}
      content={content}
      setContent={setContent}
      color={color}
      setColor={setColor}
      reminder={reminder}
      setReminder={setReminder}
      pinned={pinned}
      setPinned={setPinned}
      busy={busy}
      setBusy={setBusy}
      error={error}
      setError={setError}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function NoteEditorInner(props: {
  open: boolean;
  note: WorkspaceNote | null;
  title: string;
  setTitle: (value: string) => void;
  content: string;
  setContent: (value: string) => void;
  color: NoteColor;
  setColor: (value: NoteColor) => void;
  reminder: string;
  setReminder: (value: string) => void;
  pinned: boolean;
  setPinned: (value: boolean) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  onClose: () => void;
  onSaved: (note: WorkspaceNote) => void;
}) {
  const { open, note, title, setTitle, content, setContent, color, setColor, reminder, setReminder, pinned, setPinned, busy, setBusy, error, setError, onClose, onSaved } = props;
  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(note ? `/api/notes/${note.id}` : "/api/notes", {
        method: note ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          color,
          isPinned: pinned,
          reminderAt: reminder ? manilaInputToIso(reminder) : "",
        }),
      });
      const payload = (await response.json()) as { note?: WorkspaceNote; error?: string };
      if (!response.ok || !payload.note) throw new Error(payload.error || "Could not save the note.");
      onSaved(payload.note);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
      <div className="tech-modal-overlay fixed inset-0 z-[120] grid place-items-center overflow-y-auto p-3 sm:p-5" onMouseDown={(event) => event.currentTarget === event.target && !busy && onClose()}>
        <form onSubmit={submit} className="tech-modal-surface w-full max-w-2xl overflow-hidden rounded-[28px] border">
          <header className="flex items-start gap-4 border-b border-white/10 bg-card/95 p-5 backdrop-blur sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><StickyNote className="size-5" /></span>
            <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-100">{note ? "Edit note" : "New note"}</h2><p className="mt-1 text-sm text-slate-400">Write anything and optionally schedule a Philippine-time reminder.</p></div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close note editor" className="grid size-10 place-items-center rounded-lg text-slate-400"><X className="size-5" /></button>
          </header>
          <div className="grid gap-4 p-5 sm:p-6">
            <Field label="Title"><input autoFocus required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Note title" /></Field>
            <Field label="Content"><textarea maxLength={50000} rows={9} value={content} onChange={(event) => setContent(event.target.value)} className={`${inputClass} min-h-44 resize-y py-3`} placeholder="Write your note..." /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reminder (Philippine time)"><input type="datetime-local" value={reminder} onChange={(event) => setReminder(event.target.value)} className={inputClass} /><span className="mt-2 block text-[11px] leading-5 text-slate-500">Leave blank for no reminder. Notes use the same in-app, browser, and email reminder settings as Assignments.</span></Field>
              <Field label="Color"><div className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[.035] px-3 py-2">{(Object.keys(colorStyles) as NoteColor[]).map((item) => <button key={item} type="button" onClick={() => setColor(item)} aria-label={`Use ${item} color`} aria-pressed={color === item} className={`grid size-7 place-items-center rounded-lg ${color === item ? "ring-2 ring-white/80 ring-offset-2 ring-offset-card" : ""}`}><span className={`size-4 rounded-lg ${colorStyles[item].dot}`} /></button>)}</div></Field>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-slate-300"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="size-4 accent-primary" /><span><strong className="font-semibold text-slate-100">Pin this note</strong><span className="mt-0.5 block text-xs text-slate-500">Pinned notes stay at the top of your active notes.</span></span></label>
            {error ? <div role="alert" className="rounded-2xl border border-red-300/20 bg-red-400/[.08] px-4 py-3 text-sm text-red-300">{error}</div> : null}
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-card/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-lg px-5 text-sm font-semibold text-slate-200">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{note ? "Save changes" : "Create note"}</button>
          </footer>
        </form>
      </div>
    </ModalPortal>
  );
}

function StatCard({ label, value, icon: Icon, danger = false }: { label: string; value: number; icon: typeof StickyNote; danger?: boolean }) {
  return <div className="tech-card rounded-[20px] p-4"><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${danger ? "bg-red-400/10 text-red-300" : "bg-primary/10 text-primary"}`}><Icon className="size-4.5" /></span><div><p className="text-xs text-slate-500">{label}</p><strong className="mt-0.5 block text-lg font-semibold text-slate-100">{value}</strong></div></div></div>;
}

function IconButton({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={`grid size-9 place-items-center rounded-lg ${danger ? "text-red-300" : "text-slate-400 hover:text-primary"}`}>{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>;
}

function getReminderState(note: WorkspaceNote, nowMs: number) {
  if (!note.reminder_at) return { label: "No reminder", className: "border-white/10 bg-white/[.03] text-slate-400" };
  if (note.reminder_sent_at) return { label: "Reminder sent", className: "border-emerald-300/15 bg-emerald-400/[.07] text-emerald-300" };
  if (nowMs > 0 && new Date(note.reminder_at).getTime() < nowMs) return { label: "Reminder due", className: "border-amber-300/20 bg-amber-400/[.08] text-amber-300" };
  return { label: "Reminder scheduled", className: "border-primary/15 bg-primary/[.07] text-primary" };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}

function formatRelative(value: string, nowMs: number) {
  if (!nowMs) return "recently";
  const difference = nowMs - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : formatDateTime(value);
}

function toManilaInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 16);
}

function manilaInputToIso(value: string) {
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}+08:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

const inputClass = "min-h-11 w-full rounded-2xl border border-white/10 bg-white/[.045] px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-primary/45 focus:ring-4 focus:ring-primary/15";
