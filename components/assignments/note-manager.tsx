"use client";

import { Loader2, Pin, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import type { AssignmentNote } from "@/lib/assignments/types";
import { formatDateTime } from "@/lib/assignments/utils";

export function NoteManager({ assignmentId, initialNotes }: { assignmentId: number; initialNotes: AssignmentNote[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault(); if (!content.trim()) return; setBusyId("new");
    try { const response = await fetch(`/api/assignments/${assignmentId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, isPinned: pinned }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Could not add note."); setItems((current) => [payload.note, ...current]); setContent(""); setPinned(false); router.refresh(); }
    catch (error) { window.alert(error instanceof Error ? error.message : "Could not add note."); } finally { setBusyId(null); }
  }

  async function patch(item: AssignmentNote, data: Record<string, unknown>) {
    setBusyId(item.id); try { const response = await fetch(`/api/assignments/${assignmentId}/notes/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Could not update note."); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...(data.isPinned !== undefined ? { is_pinned: Boolean(data.isPinned) } : {}) } : entry)); router.refresh(); }
    catch (error) { window.alert(error instanceof Error ? error.message : "Could not update note."); } finally { setBusyId(null); }
  }

  async function remove(item: AssignmentNote) { if (!window.confirm("Delete this note?")) return; setBusyId(item.id); try { const response = await fetch(`/api/assignments/${assignmentId}/notes/${item.id}`, { method: "DELETE" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Could not delete note."); setItems((current) => current.filter((entry) => entry.id !== item.id)); router.refresh(); } catch (error) { window.alert(error instanceof Error ? error.message : "Could not delete note."); } finally { setBusyId(null); } }

  return <div className="space-y-3"><form onSubmit={add} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={20000} placeholder="Write a note" className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.045] p-3 text-sm outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15" /><div className="mt-2 flex items-center justify-between gap-2"><label className="inline-flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-4 accent-[#1a73e8]" />Pin note</label><button disabled={busyId === "new"} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busyId === "new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add note</button></div></form>{items.length ? items.map((item) => <article key={item.id} className={`rounded-2xl border p-4 ${item.is_pinned ? "border-amber-300/25 bg-amber-400/10" : "border-white/10 bg-white/[0.035]"}`}><div className="flex items-start gap-3"><p className="flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{item.content}</p><button onClick={() => patch(item, { isPinned: !item.is_pinned })} className={`grid size-8 place-items-center rounded-full ${item.is_pinned ? "text-amber-300" : "text-slate-400 hover:bg-white/[0.045]"}`}><Pin className="size-4" /></button><button onClick={() => remove(item)} className="grid size-8 place-items-center rounded-full text-red-300 hover:bg-red-400/10">{busyId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button></div><time className="mt-3 block text-xs text-slate-400">{formatDateTime(item.created_at)}</time></article>) : <p className="rounded-2xl bg-white/[0.035] p-4 text-sm text-slate-400">No notes yet.</p>}</div>;
}
