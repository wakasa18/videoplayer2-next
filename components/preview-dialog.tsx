"use client";

import { AnimatePresence, motion } from "motion/react";
import { Download, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { FilePreview } from "@/components/file-preview";
import { FileTypeIcon } from "@/components/file-type-icon";
import type { ImportantFile } from "@/lib/files/types";
import { formatBytes } from "@/lib/files/utils";

type PreviewDialogProps = {
  file: ImportantFile;
  open: boolean;
  onClose: () => void;
};

export function PreviewDialog({ file, open, onClose }: PreviewDialogProps) {
  useEffect(() => {
    if (!open) return;

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeWithEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeWithEscape);
      document.body.style.overflow = "";
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#202124]/55 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${file.title}`}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <header className="flex items-center gap-3 border-b border-[#e1e5ea] px-4 py-3 sm:px-5">
              <FileTypeIcon
                file={file}
                className="size-10 rounded-xl"
                iconClassName="size-5"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-[#202124] sm:text-base">
                  {file.title}
                </h2>
                <p className="truncate text-xs text-[#80868b]">
                  {file.original_filename} · {formatBytes(file.file_size)}
                </p>
              </div>
              <Link
                href={`/dashboard/files/${file.id}`}
                className="hidden size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] sm:grid"
                aria-label="Open file details"
              >
                <ExternalLink className="size-5" aria-hidden="true" />
              </Link>
              <a
                href={`/api/files/${file.id}/download`}
                className="grid size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"
                aria-label="Download file"
              >
                <Download className="size-5" aria-hidden="true" />
              </a>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"
                onClick={onClose}
                aria-label="Close preview"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 bg-[#f1f3f4] p-2 sm:p-4">
              <FilePreview file={file} compact />
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
