/* eslint-disable react-hooks/set-state-in-effect -- subject form resets when selected record changes */
"use client";

import { ModalPortal } from "@/components/ui/modal-portal";

import { AnimatePresence, motion } from "motion/react";
import { Archive, Loader2, Pencil, Plus, RotateCcw, Settings2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import type { AssignmentSubject } from "@/lib/assignments/types";

export function SubjectManagerDialog({
  open,
  initialSubjects,
  onClose,
}: {
  open: boolean;
  initialSubjects: AssignmentSubject[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [subjects, setSubjects] = useState(initialSubjects);
  const [selected, setSelected] = useState<AssignmentSubject | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [schedule, setSchedule] = useState("");
  const [semester, setSemester] = useState("");
  const [color, setColor] = useState("#1a73e8");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubjects(initialSubjects);
    let cancelled = false;
    fetch("/api/assignments/subjects", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load subjects.");
        if (!cancelled) setSubjects(payload.subjects ?? []);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load subjects.");
      });
    return () => { cancelled = true; };
  }, [initialSubjects, open]);
  useEffect(() => {
    setName(selected?.name ?? ""); setCode(selected?.code ?? ""); setInstructor(selected?.instructor ?? "");
    setSchedule(selected?.schedule ?? ""); setSemester(selected?.semester ?? ""); setColor(selected?.color ?? "#1a73e8"); setError("");
  }, [selected]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(selected ? `/api/assignments/subjects/${selected.id}` : "/api/assignments/subjects", {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, instructor, schedule, semester, color }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The subject could not be saved.");
      const refresh = await fetch("/api/assignments/subjects", { cache: "no-store" });
      const list = await refresh.json();
      if (refresh.ok) setSubjects(list.subjects ?? []);
      setSelected(null); setName(""); setCode(""); setInstructor(""); setSchedule(""); setSemester(""); setColor("#1a73e8");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The subject could not be saved."); }
    finally { setBusy(false); }
  }

  async function action(subject: AssignmentSubject, actionName: "archive" | "restore" | "delete") {
    if (actionName === "delete" && !window.confirm(`Permanently delete “${subject.name}”?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/assignments/subjects/${subject.id}`, {
        method: actionName === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: actionName === "delete" ? undefined : JSON.stringify({ action: actionName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The subject could not be updated.");
      setSubjects((items) => actionName === "delete" ? items.filter((item) => item.id !== subject.id) : items.map((item) => item.id === subject.id ? { ...item, is_archived: actionName === "archive" } : item));
      if (selected?.id === subject.id) setSelected(null);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The subject could not be updated."); }
    finally { setBusy(false); }
  }

  return <ModalPortal><AnimatePresence>{open ? (
    <motion.div className="tech-modal-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-3 sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="tech-modal-surface max-h-[94dvh] w-full max-w-5xl overflow-hidden rounded-[28px] border" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
        <header className="flex items-start gap-4 border-b border-white/10 p-5 sm:p-6"><span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Settings2 className="size-5" /></span><div className="flex-1"><h2 className="text-lg font-semibold text-slate-100">Manage subjects</h2><p className="mt-1 text-sm text-slate-400">Create, edit, archive, and restore assignment subjects.</p></div><button onClick={onClose} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"><X className="size-5" /></button></header>
        <div className="grid max-h-[calc(94dvh-94px)] overflow-auto lg:grid-cols-[1.05fr_.95fr]">
          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r sm:p-6"><div className="space-y-2">{subjects.length ? subjects.map((subject) => <div key={subject.id} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3"><span className="size-3 rounded-full" style={{ backgroundColor: subject.color }} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-100">{subject.name}</strong><small className="text-xs text-slate-400">{subject.code || "No code"}{subject.is_archived ? " · Archived" : ""}</small></div><button onClick={() => setSelected(subject)} className="grid size-9 place-items-center rounded-full hover:bg-white/[0.06]"><Pencil className="size-4" /></button><button onClick={() => action(subject, subject.is_archived ? "restore" : "archive")} className="grid size-9 place-items-center rounded-full hover:bg-white/[0.06]">{subject.is_archived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}</button><button onClick={() => action(subject, "delete")} className="grid size-9 place-items-center rounded-full text-red-300 hover:bg-red-400/10"><Trash2 className="size-4" /></button></div>) : <p className="rounded-2xl bg-white/[0.035] p-5 text-sm text-slate-400">No subjects yet.</p>}</div></div>
          <form onSubmit={save} className="space-y-4 p-5 sm:p-6"><div className="flex items-center gap-2"><Plus className="size-5 text-cyan-300" /><h3 className="font-semibold text-slate-100">{selected ? "Edit subject" : "New subject"}</h3></div><Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputClass} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Code"><input value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} className={inputClass} /></Field><Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className={`${inputClass} p-2`} /></Field></div><Field label="Instructor"><input value={instructor} onChange={(e) => setInstructor(e.target.value)} maxLength={100} className={inputClass} /></Field><Field label="Schedule"><input value={schedule} onChange={(e) => setSchedule(e.target.value)} maxLength={255} className={inputClass} /></Field><Field label="Semester"><input value={semester} onChange={(e) => setSemester(e.target.value)} maxLength={100} className={inputClass} /></Field>{error ? <div className="rounded-2xl border border-red-300/25 bg-red-400/10 p-3 text-sm text-red-300">{error}</div> : null}<div className="flex gap-2"><button type="submit" disabled={busy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{selected ? "Save subject" : "Add subject"}</button>{selected ? <button type="button" onClick={() => setSelected(null)} className="min-h-11 rounded-full border border-white/10 px-5 text-sm font-semibold">Cancel</button> : null}</div></form>
        </div>
      </motion.div>
    </motion.div>
  ) : null}</AnimatePresence></ModalPortal>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>; }
const inputClass = "min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15";
