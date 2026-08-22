"use client";

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
      <button type="button" onClick={() => void restore()} disabled={busy !== null} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#1967d2] transition hover:bg-[#f8f9fa] disabled:opacity-50">{busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore</button>
      <button type="button" onClick={() => { setError(""); setConfirmOpen(true); }} disabled={busy !== null} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#f6c7c3] bg-white px-4 text-sm font-semibold text-[#c5221f] transition hover:bg-[#fce8e6] disabled:opacity-50"><Trash2 className="size-4" /> Delete forever</button>
    </div>
    {error && !confirmOpen ? <p role="alert" className="mt-2 text-right text-xs text-[#c5221f]">{error}</p> : null}
    <AnimatePresence>{confirmOpen ? <motion.div className="fixed inset-0 z-[110] grid place-items-center bg-[#202124]/45 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setConfirmOpen(false); }}><motion.section className="w-full max-w-md overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white shadow-2xl" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} transition={{ type: "spring", stiffness: 330, damping: 28 }}><div className="flex items-start gap-4 border-b border-[#eef1f3] p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fce8e6] text-[#c5221f]"><AlertTriangle className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-[#202124]">Delete forever?</h2><p className="mt-1 truncate text-sm text-[#80868b]">{props.title}</p></div><button type="button" onClick={() => setConfirmOpen(false)} disabled={busy !== null} className="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"><X className="size-5" /></button></div><div className="p-5"><p className="text-sm leading-6 text-[#5f6368]">This permanently removes the database record and private Storage object. This action cannot be undone.</p>{error ? <div role="alert" className="mt-4 rounded-2xl border border-[#f6c7c3] bg-[#fce8e6] px-4 py-3 text-sm text-[#a50e0e]">{error}</div> : null}</div><div className="flex flex-col-reverse gap-2 border-t border-[#eef1f3] p-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirmOpen(false)} disabled={busy !== null} className="min-h-11 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]">Cancel</button><button type="button" onClick={() => void permanentDelete()} disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#d93025] px-5 text-sm font-semibold text-white hover:bg-[#b3261e] disabled:opacity-60">{busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete forever</button></div></motion.section></motion.div> : null}</AnimatePresence>
  </>;
}
