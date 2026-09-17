"use client";

import { Check, Download, Star } from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FileItemActions } from "@/components/file-item-actions";
import { FileTypeIcon } from "@/components/file-type-icon";
import { MobileSwipeActions } from "@/components/mobile/swipe-actions";
import { PreviewDialog } from "@/components/preview-dialog";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, formatDate, getFileExtension } from "@/lib/files/utils";
import { showNotice } from "@/components/ui/confirm-dialog";

type FileCardProps = {
  file: ImportantFile;
  index: number;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
};

export function FileCard({ file, index, selected = false, onSelectedChange }: FileCardProps) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const extension = getFileExtension(file).toUpperCase() || "FILE";

  async function toggleFavorite() {
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "favorite", favorite: !file.is_favorite }),
      });
      if (!response.ok) throw new Error("Could not update favorite status.");
      router.refresh();
    } catch (error) {
      (await showNotice(error instanceof Error ? error.message : "Could not update favorite status."));
    }
  }

  const card = (
    <article
      draggable
      onDragStartCapture={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-damons-file", JSON.stringify({ id: file.id, title: file.title })); }}
      className={`tech-panel tech-card tech-interactive tech-card-reveal group relative flex min-h-[220px] flex-col overflow-hidden rounded-[22px] text-card-foreground ${selected ? "ring-2 ring-primary/60" : ""}`}
      style={{ "--card-reveal-delay": `${Math.min(index, 8) * 18}ms` } as React.CSSProperties}
    >
      {onSelectedChange ? (
        <button
          type="button"
          aria-label={selected ? `Deselect ${file.title}` : `Select ${file.title}`}
          aria-pressed={selected}
          onClick={(event) => { event.stopPropagation(); onSelectedChange(!selected); }}
          className={`absolute left-3 top-3 z-20 grid size-8 place-items-center rounded-xl border transition ${selected ? "border-primary/50 bg-primary text-[#122f29]" : "border-white/15 bg-card/85 text-transparent hover:text-slate-300"}`}
        >
          <Check className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        data-no-glass
        className="relative flex min-h-32 flex-1 flex-col items-center justify-center overflow-hidden bg-card p-5 text-center"
        onClick={() => canPreviewFile(file) && setPreviewOpen(true)}
        aria-label={canPreviewFile(file) ? `Preview ${file.title}` : file.title}
      >
        <div className="tech-scanline" aria-hidden="true" />
        <FileTypeIcon file={file} className="size-16 rounded-[20px]" iconClassName="size-8" />
        <span className="mt-3 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-slate-300">{extension}</span>
      </button>
      <div className="flex items-start gap-3 border-t border-white/10 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><h3 className="truncate text-sm font-semibold text-slate-100">{file.title}</h3>{file.is_favorite ? <Star className="size-3.5 shrink-0 fill-amber-300 text-amber-300" aria-label="Favorite" /> : null}</div>
          <p className="mt-1 truncate text-xs text-slate-400">{formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}</p>
        </div>
        <FileItemActions file={file} onPreview={canPreviewFile(file) ? () => setPreviewOpen(true) : undefined} />
      </div>
    </article>
  );

  return (
    <>
      <MobileSwipeActions
        leftActions={[{ label: "Download", icon: <Download className="size-5" />, onClick: () => { const anchor = document.createElement("a"); anchor.href = `/api/files/${file.id}/download`; anchor.click(); }, tone: "cyan" }]}
        rightActions={[{ label: file.is_favorite ? "Unstar" : "Star", icon: <Star className="size-5" />, onClick: () => void toggleFavorite(), tone: "amber" }]}
      >
        {card}
      </MobileSwipeActions>
      <PreviewDialog file={file} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </>
  );
}
