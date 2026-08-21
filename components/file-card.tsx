"use client";

import { motion } from "motion/react";
import { Download, Eye, Info, MoreVertical, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FileTypeIcon } from "@/components/file-type-icon";
import { PreviewDialog } from "@/components/preview-dialog";
import type { ImportantFile } from "@/lib/files/types";
import {
  canPreviewFile,
  formatBytes,
  formatDate,
  getFileExtension,
} from "@/lib/files/utils";

type FileCardProps = {
  file: ImportantFile;
  index: number;
};

export function FileCard({ file, index }: FileCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const extension = getFileExtension(file).toUpperCase() || "FILE";

  return (
    <>
      <motion.article
        className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-[22px] border border-[#e1e5ea] bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#c6dafc] hover:shadow-md"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: Math.min(index, 18) * 0.03, duration: 0.24 }}
      >
        <button
          type="button"
          className="flex min-h-32 flex-1 flex-col items-center justify-center bg-gradient-to-br from-[#f8f9fa] to-[#eef3fd] p-5 text-center"
          onClick={() => canPreviewFile(file) && setPreviewOpen(true)}
          aria-label={canPreviewFile(file) ? `Preview ${file.title}` : file.title}
        >
          <FileTypeIcon
            file={file}
            className="size-16 rounded-[20px] shadow-sm"
            iconClassName="size-8"
          />
          <span className="mt-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-[#80868b] shadow-sm">
            {extension}
          </span>
        </button>

        <div className="flex items-start gap-3 border-t border-[#eef1f3] p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-[#202124]">
                {file.title}
              </h3>
              {file.is_favorite ? (
                <Star
                  className="size-3.5 shrink-0 fill-[#f9ab00] text-[#f9ab00]"
                  aria-label="Favorite"
                />
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs text-[#80868b]">
              {formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}
            </p>
          </div>

          <details className="relative shrink-0">
            <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] [&::-webkit-details-marker]:hidden">
              <MoreVertical className="size-5" aria-hidden="true" />
              <span className="sr-only">File actions</span>
            </summary>
            <div className="absolute bottom-11 right-0 z-20 w-48 rounded-2xl border border-[#e1e5ea] bg-white p-2 shadow-xl">
              {canPreviewFile(file) ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-[#3c4043] transition hover:bg-[#f1f3f4]"
                >
                  <Eye className="size-4" aria-hidden="true" /> Preview
                </button>
              ) : null}
              <Link
                href={`/dashboard/files/${file.id}`}
                className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-[#3c4043] transition hover:bg-[#f1f3f4]"
              >
                <Info className="size-4" aria-hidden="true" /> Details
              </Link>
              <a
                href={`/api/files/${file.id}/download`}
                className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-[#3c4043] transition hover:bg-[#f1f3f4]"
              >
                <Download className="size-4" aria-hidden="true" /> Download
              </a>
            </div>
          </details>
        </div>
      </motion.article>

      <PreviewDialog
        file={file}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
