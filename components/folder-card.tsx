"use client";

import { ChevronRight, Folder, Loader2 } from "@/components/ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FolderItemActions } from "@/components/folder-item-actions";
import type { FileBrowserFilters, FolderSummary } from "@/lib/files/types";
import { buildFileQuery, formatBytes, formatDate } from "@/lib/files/utils";
import { showNotice } from "@/components/ui/confirm-dialog";

type FolderCardProps = { folder: FolderSummary; filters: FileBrowserFilters; index: number };

export function FolderCard({ folder, filters, index }: FolderCardProps) {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [moving, setMoving] = useState(false);

  async function drop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    if (moving) return;
    const fileRaw = event.dataTransfer.getData("application/x-damons-file");
    const folderRaw = event.dataTransfer.getData("application/x-damons-folder");
    try {
      setMoving(true);
      if (fileRaw) {
        const item = JSON.parse(fileRaw) as { id?: number };
        if (!item.id) return;
        const response = await fetch(`/api/files/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", folderPath: folder.path }) });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not move file.");
      } else if (folderRaw) {
        const item = JSON.parse(folderRaw) as { path?: string; name?: string };
        if (!item.path || item.path === folder.path || folder.path.startsWith(`${item.path}/`)) return;
        const response = await fetch("/api/files/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", sourcePath: item.path, destinationParent: folder.path, name: item.name || item.path.split("/").at(-1) }) });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not move folder.");
      } else return;
      router.refresh();
    } catch (error) {
      (await showNotice(error instanceof Error ? error.message : "Could not move item."));
    } finally {
      setMoving(false);
    }
  }

  return (
    <article
      draggable={!moving}
      onDragStartCapture={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-damons-folder", JSON.stringify({ path: folder.path, name: folder.name })); }}
      onDragOver={(event) => { if (event.dataTransfer.types.some((type) => type.startsWith("application/x-damons-"))) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOver(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false); }}
      onDrop={drop}
      className={`tech-panel tech-card tech-interactive tech-card-reveal relative flex min-h-28 items-center overflow-hidden rounded-[22px] text-card-foreground transition ${dragOver ? "border-primary/50 bg-primary/[.08] ring-2 ring-primary/25" : ""}`}
      style={{ "--card-reveal-delay": `${Math.min(index, 8) * 18}ms` } as React.CSSProperties}
    >
      <Link href={buildFileQuery(filters, { folder: folder.path, page: 1 })} className="group flex min-w-0 flex-1 items-center gap-4 p-4 pr-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
          {moving ? <Loader2 className="size-6 animate-spin" /> : <Folder className="size-6 fill-current" />}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold text-slate-100">{folder.name}</strong>
          <small className="mt-1 block text-xs text-slate-400">{folder.fileCount.toLocaleString()} file{folder.fileCount === 1 ? "" : "s"} · {formatBytes(folder.totalBytes)}</small>
          <small className="mt-1 block text-xs text-slate-500">{dragOver ? "Drop here to move" : `Updated ${formatDate(folder.updatedAt)}`}</small>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
      <div className="mr-3 shrink-0"><FolderItemActions folder={folder} /></div>
    </article>
  );
}
