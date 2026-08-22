"use client";

import { Download, Eye, FilePenLine, FolderInput, Info, MoreVertical, Share2, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FileManagementDialog } from "@/components/file-management-dialog";
import { ShareDialog } from "@/components/share-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ImportantFile } from "@/lib/files/types";

type FileItemActionsProps = {
  file: ImportantFile;
  onPreview?: () => void;
};

type DialogMode = "edit" | "move" | "trash" | null;

export function FileItemActions({ file, onPreview }: FileItemActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DialogMode>(null);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function toggleFavorite() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "favorite", favorite: !file.is_favorite }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not update favorite status.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update favorite status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="grid size-9 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e8f0fe]" aria-label={`Actions for ${file.title}`}>
            <MoreVertical className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[#e1e5ea] bg-white p-2 shadow-xl">
          {onPreview ? <DropdownMenuItem onSelect={onPreview} className={itemClass}><Eye /> Preview</DropdownMenuItem> : null}
          <DropdownMenuItem asChild className={itemClass}><Link href={`/dashboard/files/${file.id}`}><Info /> Details</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={itemClass}><a href={`/api/files/${file.id}/download`}><Download /> Download</a></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)} className={itemClass}><Share2 /> Share</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#eef1f3]" />
          <DropdownMenuItem onSelect={() => setMode("edit")} className={itemClass}><FilePenLine /> Edit details</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("move")} className={itemClass}><FolderInput /> Move</DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={() => void toggleFavorite()} className={itemClass}><Star className={file.is_favorite ? "fill-[#f9ab00] text-[#f9ab00]" : ""} /> {file.is_favorite ? "Remove from starred" : "Add to starred"}</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#eef1f3]" />
          <DropdownMenuItem onSelect={() => setMode("trash")} className={`${itemClass} text-[#c5221f] focus:bg-[#fce8e6] focus:text-[#c5221f]`}><Trash2 /> Move to Recycle Bin</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FileManagementDialog file={file} mode={mode} onClose={() => setMode(null)} />
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} shareType="file" fileId={file.id} targetName={file.title} />
    </>
  );
}

const itemClass = "min-h-10 cursor-pointer rounded-xl px-3 text-sm text-[#3c4043] focus:bg-[#f1f3f4] focus:text-[#202124]";
