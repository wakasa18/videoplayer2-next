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
  return <>
    <motion.article className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-[22px] border border-[#e1e5ea] bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#c6dafc] hover:shadow-md" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(index, 18) * .03, duration: .24 }}>
      <button type="button" className="flex min-h-32 flex-1 flex-col items-center justify-center bg-gradient-to-br from-[#f8f9fa] to-[#eef3fd] p-5 text-center" onClick={() => canPreviewFile(file) && setPreviewOpen(true)} aria-label={canPreviewFile(file) ? `Preview ${file.title}` : file.title}>
        <FileTypeIcon file={file} className="size-16 rounded-[20px] shadow-sm" iconClassName="size-8" />
        <span className="mt-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-[#80868b] shadow-sm">{extension}</span>
      </button>
      <div className="flex items-start gap-3 border-t border-[#eef1f3] p-4">
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h3 className="truncate text-sm font-semibold text-[#202124]">{file.title}</h3>{file.is_favorite ? <Star className="size-3.5 shrink-0 fill-[#f9ab00] text-[#f9ab00]" aria-label="Favorite" /> : null}</div><p className="mt-1 truncate text-xs text-[#80868b]">{formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}</p></div>
        <FileItemActions file={file} onPreview={canPreviewFile(file) ? () => setPreviewOpen(true) : undefined} />
      </div>
    </motion.article>
    <PreviewDialog file={file} open={previewOpen} onClose={() => setPreviewOpen(false)} />
  </>;
}
