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
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className="grid size-9 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e8f0fe]" aria-label={`Actions for ${folder.name}`}><MoreVertical className="size-5" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-2xl border-[#e1e5ea] bg-white p-2 shadow-xl">
        <DropdownMenuItem onSelect={() => setShareOpen(true)} className={itemClass}><Share2 /> Share folder</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#eef1f3]" />
        <DropdownMenuItem onSelect={() => setMode("rename")} className={itemClass}><FolderPen /> Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMode("move")} className={itemClass}><FolderInput /> Move</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#eef1f3]" />
        <DropdownMenuItem onSelect={() => setMode("trash")} className={`${itemClass} text-[#c5221f] focus:bg-[#fce8e6] focus:text-[#c5221f]`}><Trash2 /> Move to Recycle Bin</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <FolderManagementDialog folder={folder} mode={mode} onClose={() => setMode(null)} />
    <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} shareType="folder" folderPath={folder.path} targetName={folder.name} />
  </>;
}
const itemClass = "min-h-10 cursor-pointer rounded-xl px-3 text-sm text-[#3c4043] focus:bg-[#f1f3f4] focus:text-[#202124]";
