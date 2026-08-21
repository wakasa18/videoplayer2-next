"use client";

import { motion } from "motion/react";
import { Download, Eye, Info, MoreVertical, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FileTypeIcon } from "@/components/file-type-icon";
import { PreviewDialog } from "@/components/preview-dialog";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, formatDate } from "@/lib/files/utils";

export function FileList({ files }: { files: ImportantFile[] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-[#e1e5ea] bg-white shadow-sm">
      <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(120px,.65fr)_minmax(130px,.7fr)_44px] gap-4 border-b border-[#e1e5ea] bg-[#f8f9fa] px-5 py-3 text-xs font-semibold text-[#5f6368] md:grid">
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span className="sr-only">Actions</span>
      </div>
      <div className="divide-y divide-[#eef1f3]">
        {files.map((file, index) => (
          <FileListRow key={file.id} file={file} index={index} />
        ))}
      </div>
    </div>
  );
}

function FileListRow({ file, index }: { file: ImportantFile; index: number }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <motion.article
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-[#f8fafd] md:grid-cols-[minmax(0,1.6fr)_minmax(120px,.65fr)_minmax(130px,.7fr)_44px] md:gap-4 md:px-5"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index, 20) * 0.025, duration: 0.2 }}
      >
        <button
          type="button"
          className="col-span-2 flex min-w-0 items-center gap-3 text-left md:col-span-1"
          onClick={() => canPreviewFile(file) && setPreviewOpen(true)}
        >
          <FileTypeIcon
            file={file}
            className="size-11 rounded-xl"
            iconClassName="size-5"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <strong className="truncate text-sm font-semibold text-[#202124]">
                {file.title}
              </strong>
              {file.is_favorite ? (
                <Star className="size-3.5 shrink-0 fill-[#f9ab00] text-[#f9ab00]" />
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[#80868b] md:hidden">
              {formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}
            </span>
            <span className="mt-0.5 hidden truncate text-xs text-[#80868b] sm:block">
              {file.original_filename}
            </span>
          </span>
        </button>

        <span className="hidden text-sm text-[#5f6368] md:block">
          {formatBytes(file.file_size)}
        </span>
        <span className="hidden text-sm text-[#5f6368] md:block">
          {formatDate(file.updated_at ?? file.created_at)}
        </span>

        <details className="relative justify-self-end">
          <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] [&::-webkit-details-marker]:hidden">
            <MoreVertical className="size-5" aria-hidden="true" />
            <span className="sr-only">File actions</span>
          </summary>
          <div className="absolute right-0 top-10 z-20 w-48 rounded-2xl border border-[#e1e5ea] bg-white p-2 shadow-xl">
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
      </motion.article>

      <PreviewDialog
        file={file}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
