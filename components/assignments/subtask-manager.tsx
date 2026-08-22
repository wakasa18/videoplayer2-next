"use client";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import type { AssignmentSubtask } from "@/lib/assignments/types";

export function SubtaskManager({ assignmentId, initialSubtasks }: { assignmentId: number; initialSubtasks: AssignmentSubtask[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialSubtasks);
  const [title, setTitle] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusyId("new");
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/subtasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not add subtask.");
      setItems((current) => [...current, payload.subtask]); setTitle(""); router.refresh();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not add subtask."); }
    finally { setBusyId(null); }
  }

  async function update(item: AssignmentSubtask, patch: Record<string, unknown>) {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/subtasks/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not update subtask.");
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...(patch.isDone !== undefined ? { is_done: Boolean(patch.isDone) } : {}) } : entry)); router.refresh();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not update subtask."); }
    finally { setBusyId(null); }
  }

  async function remove(item: AssignmentSubtask) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/subtasks/${item.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not delete subtask.");
      setItems((current) => current.filter((entry) => entry.id !== item.id)); router.refresh();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not delete subtask."); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-3"><form onSubmit={add} className="flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a subtask" maxLength={255} className="min-h-11 flex-1 rounded-2xl border border-[#dadce0] px-4 text-sm outline-none focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]" /><button disabled={busyId === "new"} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white disabled:opacity-60">{busyId === "new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add</button></form>{items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[#e1e5ea] bg-[#f8f9fa] p-3.5"><button onClick={() => update(item, { isDone: !item.is_done })} disabled={busyId === item.id} className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border ${item.is_done ? "border-[#188038] bg-[#188038] text-white" : "border-[#bdc1c6] bg-white text-transparent"}`}><Check className="size-4" /></button><span className={`flex-1 text-sm leading-6 ${item.is_done ? "text-[#80868b] line-through" : "text-[#3c4043]"}`}>{item.title}</span><button onClick={() => remove(item)} disabled={busyId === item.id} className="grid size-8 place-items-center rounded-full text-[#c5221f] hover:bg-[#fce8e6]">{busyId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button></div>)}</div> : <p className="rounded-2xl bg-[#f8f9fa] p-4 text-sm text-[#80868b]">No subtasks yet.</p>}</div>;
}
