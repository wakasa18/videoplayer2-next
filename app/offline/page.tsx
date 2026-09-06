"use client";

import { CalendarDays, CloudOff, Download, File, RefreshCw, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getOfflineFileObjectUrl } from "@/lib/mobile/offline-files";
import { readOfflineAssignments, readOfflineFiles, type OfflineFileRecord } from "@/lib/mobile/offline-store";
import type { AssignmentItem } from "@/lib/assignments/types";
import { formatAssignmentDue, isAssignmentOverdue } from "@/lib/assignments/utils";
import { formatBytes } from "@/lib/files/utils";

export default function OfflinePage() {
  const [online, setOnline] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [files, setFiles] = useState<OfflineFileRecord[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    const timer = window.setTimeout(() => {
      sync();
      const snapshot = readOfflineAssignments();
      setAssignments(snapshot.assignments);
      setUpdatedAt(snapshot.updatedAt);
      setFiles(readOfflineFiles());
    }, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const upcoming = useMemo(() => assignments.filter((item) => item.status !== "done" && item.status !== "submitted").sort((a, b) => `${a.due_date ?? "9999"} ${a.due_time ?? "23:59"}`.localeCompare(`${b.due_date ?? "9999"} ${b.due_time ?? "23:59"}`)).slice(0, 40), [assignments]);

  async function openFile(file: OfflineFileRecord, download = false) {
    const url = await getOfflineFileObjectUrl(file.id);
    if (!url) return window.alert("This offline copy is no longer available on this device.");
    if (download) {
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.original_filename; anchor.click();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return <main className="min-h-screen bg-[#050812] px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] text-slate-100">
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-[1.7rem] border border-cyan-300/15 bg-[#091524] p-5 shadow-2xl"><div className="flex items-start gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">{online ? <Wifi className="size-6" /> : <WifiOff className="size-6" />}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-200/60">Offline workspace</p><h1 className="mt-1 text-2xl font-semibold">Damon&apos;s Archive</h1><p className="mt-2 text-sm leading-6 text-slate-400">Your cached files and assignment snapshot stay available when the network drops.</p></div></div>{online ? <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-bold text-[#04111d]"><RefreshCw className="size-4" />Return to live workspace</Link> : <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[.07] px-3 py-2 text-xs font-semibold text-amber-200"><CloudOff className="size-4" />No network connection</div>}</section>
      <section className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Assignments</p><h2 className="mt-1 text-lg font-semibold">Upcoming snapshot</h2></div><CalendarDays className="size-5 text-cyan-200" /></div>{updatedAt ? <p className="mt-1 text-[11px] text-slate-500">Last synced {new Date(updatedAt).toLocaleString()}</p> : null}<div className="mt-3 space-y-2">{upcoming.length ? upcoming.map((assignment) => <article key={assignment.id} className="rounded-xl border border-white/10 bg-[#08111f] p-3"><div className="flex items-start gap-3"><span className="mt-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: assignment.subject_color }} /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-slate-100">{assignment.title}</h3><p className={`mt-1 text-xs ${isAssignmentOverdue(assignment) ? "text-red-300" : "text-slate-400"}`}>{isAssignmentOverdue(assignment) ? "Overdue · " : ""}{formatAssignmentDue(assignment.due_date, assignment.due_time)}</p><p className="mt-1 truncate text-[11px] text-slate-500">{assignment.subject_code || assignment.subject_name}</p></div></div></article>) : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">Open Assignments while online once to save an offline snapshot.</p>}</div></section>
      <section className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Files</p><h2 className="mt-1 text-lg font-semibold">Available offline</h2></div><div className="mt-3 space-y-2">{files.length ? files.map((file) => <article key={file.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#08111f] p-3"><span className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><File className="size-5" /></span><button type="button" onClick={() => void openFile(file)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm text-slate-100">{file.title}</strong><span className="mt-0.5 block truncate text-[11px] text-slate-500">{file.original_filename} · {formatBytes(file.file_size)}</span></button><button type="button" onClick={() => void openFile(file, true)} aria-label={`Download ${file.title}`} className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-300"><Download className="size-4" /></button></article>) : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">Use “Available offline” on a file while online to store a private device copy.</p>}</div></section>
    </div>
  </main>;
}
