"use client";

import { motion } from "motion/react";
import { Check, CheckSquare, Download, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BulkFileActions } from "@/components/bulk-file-actions";
import { FileItemActions } from "@/components/file-item-actions";
import { FileTypeIcon } from "@/components/file-type-icon";
import { MobileSwipeActions } from "@/components/mobile/swipe-actions";
import { PreviewDialog } from "@/components/preview-dialog";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, formatDate } from "@/lib/files/utils";

export function FileList({ files }: { files: ImportantFile[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const ids = Array.from(selected);
  function toggle(id: number, value: boolean) { setSelected((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; }); }
  return <div className="space-y-3">
    <div className="flex justify-end"><button type="button" onClick={() => setSelected(selected.size === files.length ? new Set() : new Set(files.map((file) => file.id)))} className="inline-flex min-h-10 w-full items-center justify-center gap-2 sm:w-auto rounded-xl border border-white/10 bg-white/[.035] px-3 text-xs font-semibold text-slate-400 hover:bg-white/[.06]"><CheckSquare className="size-4" />{selected.size === files.length ? "Clear selection" : "Select all on page"}</button></div>
    <BulkFileActions selectedIds={ids} onClear={() => setSelected(new Set())} />
    <div className="tech-panel overflow-hidden rounded-[20px] sm:rounded-[22px]"><div className="hidden grid-cols-[38px_minmax(0,1.6fr)_minmax(120px,.65fr)_minmax(130px,.7fr)_44px] gap-4 border-b border-white/10 bg-white/[0.035] px-5 py-3 text-xs font-semibold text-slate-400 md:grid"><span /><span>Name</span><span>Size</span><span>Modified</span><span className="sr-only">Actions</span></div><div className="divide-y divide-white/10">{files.map((file, index) => <FileListRow key={file.id} file={file} index={index} selected={selected.has(file.id)} onSelectedChange={(value) => toggle(file.id, value)} />)}</div></div>
  </div>;
}

function FileListRow({ file, index, selected, onSelectedChange }: { file: ImportantFile; index: number; selected: boolean; onSelectedChange: (selected: boolean) => void }) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);

  async function toggleFavorite() {
    try {
      const response = await fetch(`/api/files/${file.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favorite", favorite: !file.is_favorite }) });
      if (!response.ok) throw new Error("Could not update favorite status.");
      router.refresh();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not update favorite status."); }
  }

  return <>
    <MobileSwipeActions
      leftActions={[{ label: "Download", icon: <Download className="size-5" />, onClick: () => { const anchor = document.createElement("a"); anchor.href = `/api/files/${file.id}/download`; anchor.click(); }, tone: "cyan" }]}
      rightActions={[{ label: file.is_favorite ? "Unstar" : "Star", icon: <Star className="size-5" />, onClick: () => void toggleFavorite(), tone: "amber" }]}
    >
      <motion.article draggable onDragStartCapture={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-damons-file", JSON.stringify({ id: file.id, title: file.title })); }} className={`grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 bg-[#08111f]/60 px-4 py-3 transition hover:bg-white/[0.04] md:grid-cols-[38px_minmax(0,1.6fr)_minmax(120px,.65fr)_minmax(130px,.7fr)_44px] md:gap-4 md:bg-transparent md:px-5 ${selected ? "bg-cyan-300/[.055]" : ""}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index, 10) * .014, duration: .18 }}>
        <button type="button" aria-label={selected ? `Deselect ${file.title}` : `Select ${file.title}`} onClick={() => onSelectedChange(!selected)} className={`grid size-8 place-items-center rounded-xl border ${selected ? "border-cyan-200/50 bg-cyan-300 text-[#04111d]" : "border-white/10 bg-white/[.035] text-transparent hover:text-slate-300"}`}><Check className="size-4" /></button>
        <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => canPreviewFile(file) && setPreviewOpen(true)}><FileTypeIcon file={file} className="size-11 rounded-xl" iconClassName="size-5" /><span className="min-w-0"><span className="flex items-center gap-1.5"><strong className="truncate text-sm font-semibold text-slate-100">{file.title}</strong>{file.is_favorite ? <Star className="size-3.5 shrink-0 fill-amber-300 text-amber-300" /> : null}</span><span className="mt-0.5 block truncate text-xs text-slate-400 md:hidden">{formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}</span><span className="mt-0.5 hidden truncate text-xs text-slate-400 sm:block">{file.original_filename}</span></span></button>
        <span className="hidden text-sm text-slate-400 md:block">{formatBytes(file.file_size)}</span><span className="hidden text-sm text-slate-400 md:block">{formatDate(file.updated_at ?? file.created_at)}</span>
        <div className="justify-self-end"><FileItemActions file={file} onPreview={canPreviewFile(file) ? () => setPreviewOpen(true) : undefined} /></div>
      </motion.article>
    </MobileSwipeActions>
    <PreviewDialog file={file} open={previewOpen} onClose={() => setPreviewOpen(false)} />
  </>;
}
