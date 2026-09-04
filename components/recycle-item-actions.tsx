"use client";

import { ModalPortal } from "@/components/ui/modal-portal";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RecycleItemActionsProps =
  | { kind: "file"; id: number; title: string }
  | { kind: "folder"; path: string; title: string };

export function RecycleItemActions(props: RecycleItemActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"restore" | "delete" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  async function restore() {
    setBusy("restore");
    setError("");
    try {
      const response = props.kind === "file"
        ? await fetch(`/api/files/${props.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) })
        : await fetch("/api/files/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", sourcePath: props.path }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not restore item.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restore item.");
    } finally {
      setBusy(null);
    }
  }

  async function permanentDelete() {
    setBusy("delete");
    setError("");
    try {
      const response = props.kind === "file"
        ? await fetch(`/api/files/${props.id}`, { method: "DELETE" })
        : await fetch(`/api/files/folders?path=${encodeURIComponent(props.path)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not permanently delete item.");
      setConfirmOpen(false);
      router.refresh();
      if (payload.warning) window.alert(payload.warning);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not permanently delete item.");
    } finally {
      setBusy(null);
    }
  }

  return <>
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={() => void restore()} disabled={busy !== null} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-cyan-300 transition hover:bg-white/[0.06] disabled:opacity-50">{busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore</button>
      <button type="button" onClick={() => { setError(""); setConfirmOpen(true); }} disabled={busy !== null} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-300/25 bg-white/[0.045] px-4 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"><Trash2 className="size-4" /> Delete forever</button>
    </div>
    {error && !confirmOpen ? <p role="alert" className="mt-2 text-right text-xs text-red-300">{error}</p> : null}
    <ModalPortal><AnimatePresence>{confirmOpen ? <motion.div className="tech-modal-overlay fixed inset-0 z-[110] grid place-items-center overflow-y-auto p-3 sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setConfirmOpen(false); }}><motion.section className="tech-modal-surface w-full max-w-md overflow-hidden rounded-[28px] border" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} transition={{ type: "spring", stiffness: 330, damping: 28 }}><div className="flex items-start gap-4 border-b border-white/10 p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-400/10 text-red-300"><AlertTriangle className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-100">Delete forever?</h2><p className="mt-1 truncate text-sm text-slate-400">{props.title}</p></div><button type="button" onClick={() => setConfirmOpen(false)} disabled={busy !== null} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"><X className="size-5" /></button></div><div className="p-5"><p className="text-sm leading-6 text-slate-400">This permanently removes the database record and private Storage object. This action cannot be undone.</p>{error ? <div role="alert" className="mt-4 rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}</div><div className="flex flex-col-reverse gap-2 border-t border-white/10 p-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirmOpen(false)} disabled={busy !== null} className="min-h-11 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]">Cancel</button><button type="button" onClick={() => void permanentDelete()} disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#fb7185,#ef4444)] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">{busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete forever</button></div></motion.section></motion.div> : null}</AnimatePresence></ModalPortal>
  </>;
}
