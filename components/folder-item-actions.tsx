"use client";

import { FolderInput, FolderPen, MoreVertical, Share2, Trash2 } from "lucide-react";
import { useState } from "react";

import { FolderManagementDialog } from "@/components/folder-management-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { FolderSummary } from "@/lib/files/types";

type Mode = "rename" | "move" | "trash" | null;

export function FolderItemActions({ folder }: { folder: FolderSummary }) {
  const [mode, setMode] = useState<Mode>(null);
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className="grid size-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40" aria-label={`Actions for ${folder.name}`}><MoreVertical className="size-5" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl border-white/10 bg-[#0b1220]/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <DropdownMenuItem onSelect={() => setShareOpen(true)} className={itemClass}><Share2 /> Share folder</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onSelect={() => setMode("rename")} className={itemClass}><FolderPen /> Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("move")} className={itemClass}><FolderInput /> Move</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onSelect={() => setMode("trash")} className={`${itemClass} text-red-300 focus:bg-red-400/10 focus:text-red-200`}><Trash2 /> Move to Recycle Bin</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FolderManagementDialog folder={folder} mode={mode} onClose={() => setMode(null)} />
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} shareType="folder" folderPath={folder.path} targetName={folder.name} />
    </>
  );
}
const itemClass = "min-h-10 cursor-pointer rounded-xl px-3 text-sm text-slate-300 transition-colors focus:bg-white/[0.07] focus:text-slate-100 [&_svg]:size-4 [&_svg]:text-slate-400 focus:[&_svg]:text-cyan-200";
