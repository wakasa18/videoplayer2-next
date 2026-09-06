"use client";

import { FolderInput, Loader2, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BulkFileActions({ selectedIds, onClear }: { selectedIds: number[]; onClear: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: "favorite" | "move" | "trash", extra: Record<string, unknown> = {}) {
    if (!selectedIds.length || busy) return;
    if (action === "trash" && !window.confirm(`Move ${selectedIds.length} selected file${selectedIds.length === 1 ? "" : "s"} to the Recycle Bin?`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/files/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, action, ...extra }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Bulk action failed.");
      onClear();
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  function move() {
    const destination = window.prompt("Move selected files to which folder? Leave blank for Important Files root.", "");
    if (destination === null) return;
    void run("move", { folderPath: destination });
  }

  if (!selectedIds.length) return null;
  return (
    <div className="sticky top-[calc(4.75rem+env(safe-area-inset-top))] z-30 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-300/20 bg-[#0a1524]/96 p-2.5 shadow-[0_18px_45px_rgba(0,0,0,.35)] backdrop-blur-xl">
      <span className="px-2 text-xs font-semibold text-cyan-100">{selectedIds.length} selected</span>
      <button disabled={busy} onClick={() => void run("favorite", { favorite: true })} className={buttonClass}><Star className="size-4" /> Star</button>
      <button disabled={busy} onClick={move} className={buttonClass}><FolderInput className="size-4" /> Move</button>
      <button disabled={busy} onClick={() => void run("trash")} className={`${buttonClass} text-red-300`}><Trash2 className="size-4" /> Recycle</button>
      <button disabled={busy} onClick={onClear} className="ml-auto grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-white/[.06]"><X className="size-4" /></button>
      {busy ? <Loader2 className="size-4 animate-spin text-cyan-300" /> : null}
    </div>
  );
}

const buttonClass = "inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[.08] disabled:opacity-50";
