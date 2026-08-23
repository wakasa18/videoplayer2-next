"use client";

import { motion } from "motion/react";
import { Star } from "lucide-react";
import { useState } from "react";

import { FileItemActions } from "@/components/file-item-actions";
import { FileTypeIcon } from "@/components/file-type-icon";
import { PreviewDialog } from "@/components/preview-dialog";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, formatDate, getFileExtension } from "@/lib/files/utils";

type FileCardProps = { file: ImportantFile; index: number };

export function FileCard({ file, index }: FileCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const extension = getFileExtension(file).toUpperCase() || "FILE";

  return (
    <>
      <motion.article
        className="tech-panel tech-interactive group relative flex min-h-[220px] flex-col overflow-hidden rounded-[22px] text-card-foreground"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: Math.min(index, 18) * 0.03, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          type="button"
          className="relative flex min-h-32 flex-1 flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_15%,rgba(47,214,255,0.12),transparent_42%),linear-gradient(145deg,#102039_0%,#081321_100%)] p-5 text-center"
          onClick={() => canPreviewFile(file) && setPreviewOpen(true)}
          aria-label={canPreviewFile(file) ? `Preview ${file.title}` : file.title}
        >
          <div className="tech-scanline" aria-hidden="true" />
          <FileTypeIcon file={file} className="size-16 rounded-[20px]" iconClassName="size-8" />
          <span className="mt-3 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-slate-300">
            {extension}
          </span>
        </button>
        <div className="flex items-start gap-3 border-t border-white/10 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-slate-100">{file.title}</h3>
              {file.is_favorite ? (
                <Star className="size-3.5 shrink-0 fill-amber-300 text-amber-300" aria-label="Favorite" />
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs text-slate-400">
              {formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}
            </p>
          </div>
          <FileItemActions file={file} onPreview={canPreviewFile(file) ? () => setPreviewOpen(true) : undefined} />
        </div>
      </motion.article>
      <PreviewDialog file={file} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </>
  );
}
