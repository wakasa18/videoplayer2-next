/* eslint-disable react-hooks/set-state-in-effect -- dialog state resets when reopened and folder loading begins asynchronously */
"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, FolderInput, FolderPen, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { FolderSummary } from "@/lib/files/types";

type FolderMode = "rename" | "move" | "trash";
type FolderOption = { path: string; name: string; parent_path: string | null };

export function FolderManagementDialog({ folder, mode, onClose }: { folder: FolderSummary; mode: FolderMode | null; onClose: () => void }) {
  const router = useRouter();
  const parent = folder.path.includes("/") ? folder.path.split("/").slice(0, -1).join("/") : "";
  const [name, setName] = useState(folder.name);
  const [destination, setDestination] = useState(parent);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mode) return;
    setName(folder.name);
    setDestination(parent);
    setError("");
  }, [folder.name, mode, parent]);

  useEffect(() => {
    if (mode !== "move") return;
    let cancelled = false;
    setLoadingFolders(true);
    fetch("/api/files/folders", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load folders.");
        if (!cancelled) {
          setFolders((payload.folders ?? []).filter((item: FolderOption) => item.path !== folder.path && !item.path.startsWith(`${folder.path}/`)));
        }
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Could not load folders."))
      .finally(() => !cancelled && setLoadingFolders(false));
    return () => { cancelled = true; };
  }, [folder.path, mode]);

  const heading = useMemo(() => mode === "rename" ? "Rename folder" : mode === "move" ? "Move folder" : "Move folder to Recycle Bin?", [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!mode || submitting) return;
    setSubmitting(true);
    setError("");
    const body = mode === "trash"
      ? { action: "trash", sourcePath: folder.path }
      : { action: "move", sourcePath: folder.path, destinationParent: mode === "move" ? destination : parent, name };
    try {
      const response = await fetch("/api/files/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The folder could not be updated.");
      onClose();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The folder could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return <AnimatePresence>{mode ? (
    <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-[#020611]/75 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !submitting) onClose(); }}>
      <motion.form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220]/95 shadow-[0_24px_70px_rgba(0,4,14,0.6)] backdrop-blur-2xl" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} transition={{ type: "spring", stiffness: 330, damping: 28 }}>
        <div className="flex items-start gap-4 border-b border-white/10 p-5 sm:p-6">
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${mode === "trash" ? "bg-red-400/10 text-red-300" : "bg-cyan-400/10 text-cyan-300"}`}>{mode === "rename" ? <FolderPen className="size-5" /> : mode === "move" ? <FolderInput className="size-5" /> : <Trash2 className="size-5" />}</span>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-100">{heading}</h2><p className="mt-1 truncate text-sm text-slate-400">{folder.path}</p></div>
          <button type="button" onClick={onClose} disabled={submitting} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"><X className="size-5" /><span className="sr-only">Close</span></button>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {mode === "rename" ? <Field label="Folder name"><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} className={inputClass} /></Field> : null}
          {mode === "move" ? <><Field label="Destination"><select value={destination} onChange={(event) => setDestination(event.target.value)} disabled={loadingFolders} className={inputClass}><option value="">Important Files root</option>{folders.map((item) => <option key={item.path} value={item.path}>{item.path}</option>)}</select></Field><Field label="Folder name"><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} className={inputClass} /></Field>{loadingFolders ? <span className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="size-3.5 animate-spin" /> Loading folders…</span> : null}</> : null}
          {mode === "trash" ? <div className="flex gap-3 rounded-2xl border border-red-300/25 bg-red-400/10 p-4 text-sm leading-6 text-red-300"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>This moves the folder, its subfolders, and active files to the Recycle Bin as one recoverable group.</p></div> : null}
          {error ? <div role="alert" className="rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-white/10 p-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]">Cancel</button><button type="submit" disabled={submitting || loadingFolders} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60 ${mode === "trash" ? "bg-[linear-gradient(135deg,#fb7185,#ef4444)] hover:brightness-110" : "bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] hover:brightness-110"}`}>{submitting ? <Loader2 className="size-4 animate-spin" /> : null}{mode === "rename" ? "Rename folder" : mode === "move" ? "Move folder" : "Move to Recycle Bin"}</button></div>
      </motion.form>
    </motion.div>
  ) : null}</AnimatePresence>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>; }
const inputClass = "min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15 disabled:bg-white/[0.035]";
