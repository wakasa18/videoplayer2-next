"use client";

import { motion } from "motion/react";
import { ChevronRight, Folder } from "lucide-react";
import Link from "next/link";

import { FolderItemActions } from "@/components/folder-item-actions";
import type { FileBrowserFilters, FolderSummary } from "@/lib/files/types";
import { buildFileQuery, formatBytes, formatDate } from "@/lib/files/utils";

type FolderCardProps = { folder: FolderSummary; filters: FileBrowserFilters; index: number };

export function FolderCard({ folder, filters, index }: FolderCardProps) {
  return (
    <motion.article
      className="tech-panel tech-interactive relative flex min-h-28 items-center overflow-hidden rounded-[22px] text-card-foreground"
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 12) * 0.035, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={buildFileQuery(filters, { folder: folder.path, page: 1 })}
        className="group flex min-w-0 flex-1 items-center gap-4 p-4 pr-2"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300 transition-transform duration-300 group-hover:scale-105">
          <Folder className="size-6 fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold text-slate-100">{folder.name}</strong>
          <small className="mt-1 block text-xs text-slate-400">
            {folder.fileCount.toLocaleString()} file{folder.fileCount === 1 ? "" : "s"} · {formatBytes(folder.totalBytes)}
          </small>
          <small className="mt-1 block text-xs text-slate-500">Updated {formatDate(folder.updatedAt)}</small>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </Link>
      <div className="mr-3 shrink-0">
        <FolderItemActions folder={folder} />
      </div>
    </motion.article>
  );
}
