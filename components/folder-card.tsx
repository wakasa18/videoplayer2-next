"use client";

import { motion } from "motion/react";
import { ChevronRight, Folder } from "lucide-react";
import Link from "next/link";

import type { FileBrowserFilters, FolderSummary } from "@/lib/files/types";
import { buildFileQuery, formatBytes, formatDate } from "@/lib/files/utils";

type FolderCardProps = {
  folder: FolderSummary;
  filters: FileBrowserFilters;
  index: number;
};

export function FolderCard({ folder, filters, index }: FolderCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 12) * 0.035, duration: 0.24 }}
    >
      <Link
        href={buildFileQuery(filters, { folder: folder.path, page: 1 })}
        className="group flex min-h-28 items-center gap-4 rounded-[22px] border border-[#e1e5ea] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#c6dafc] hover:shadow-md"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2] transition-transform duration-200 group-hover:scale-105">
          <Folder className="size-6 fill-current" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold text-[#202124]">
            {folder.name}
          </strong>
          <small className="mt-1 block text-xs text-[#80868b]">
            {folder.fileCount.toLocaleString()} file
            {folder.fileCount === 1 ? "" : "s"} · {formatBytes(folder.totalBytes)}
          </small>
          <small className="mt-1 block text-xs text-[#9aa0a6]">
            Updated {formatDate(folder.updatedAt)}
          </small>
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-[#9aa0a6] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1967d2]"
          aria-hidden="true"
        />
      </Link>
    </motion.article>
  );
}
