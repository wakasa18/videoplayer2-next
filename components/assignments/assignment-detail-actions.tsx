"use client";

import { AlarmClock, Archive, CheckCircle2, CircleDot, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AssignmentEditorDialog } from "@/components/assignments/assignment-editor-dialog";
import type { AssignmentItem, AssignmentSubject } from "@/lib/assignments/types";

export function AssignmentDetailActions({ assignment, subjects }: { assignment: AssignmentItem; subjects: AssignmentSubject[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: "status" | "archive" | "trash", status?: string) {
    if (busy) return;
    if (action === "trash" && !window.confirm(`Move “${assignment.title}” to the Recycle Bin?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "status" ? { action, status } : { action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The assignment could not be updated.");
      if (action === "archive" || action === "trash") router.push(action === "archive" ? "/dashboard/assignments/archive" : "/dashboard/assignments/recycle");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The assignment could not be updated.");
    } finally {
      setBusy(false);
    }
  }


  async function snooze(minutes: number) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assignments/${assignment.id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The reminder could not be snoozed.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The reminder could not be snoozed.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-4 text-sm font-semibold text-white hover:brightness-110"><Pencil className="size-4" />Edit</button>
      <button type="button" onClick={() => run("status", "in_progress")} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"><CircleDot className="size-4" />In progress</button>
      <button type="button" onClick={() => run("status", "done")} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-300/20 bg-white/[0.045] px-4 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10"><CheckCircle2 className="size-4" />Done</button>
      <button type="button" onClick={() => snooze(60)} disabled={busy || assignment.status === "done" || assignment.status === "submitted"} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/20 bg-white/[0.045] px-4 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50"><AlarmClock className="size-4" />Snooze 1 hour</button>
      <button type="button" onClick={() => run("archive")} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"><Archive className="size-4" />Archive</button>
      <button type="button" onClick={() => run("trash")} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-300/25 bg-white/[0.045] px-4 text-sm font-semibold text-red-300 hover:bg-red-400/10"><Trash2 className="size-4" />Recycle</button>
      {busy ? <Loader2 className="size-4 animate-spin text-cyan-300" /> : null}
    </div>
    <AssignmentEditorDialog open={editing} assignment={assignment} subjects={subjects} onClose={() => setEditing(false)} />
  </>;
}
