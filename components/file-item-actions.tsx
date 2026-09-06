"use client";

import { CloudDownload, Download, Eye, FilePenLine, FolderInput, Info, MoreVertical, Share2, Star, Trash2, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
import { cacheFileForOffline, isFileAvailableOffline, removeOfflineFile } from "@/lib/mobile/offline-files";

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
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    let active = true;
    void isFileAvailableOffline(file.id).then((value) => active && setOfflineReady(value));
    return () => { active = false; };
  }, [file.id]);

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

  async function toggleOffline() {
    if (offlineBusy) return;
    setOfflineBusy(true);
    try {
      if (offlineReady) {
        await removeOfflineFile(file.id);
        setOfflineReady(false);
      } else {
        if (!navigator.onLine) throw new Error("Connect to the internet once to download this private offline copy.");
        await cacheFileForOffline(file);
        setOfflineReady(true);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update offline access.");
    } finally {
      setOfflineBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="grid size-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40" aria-label={`Actions for ${file.title}`}>
            <MoreVertical className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl border-white/10 bg-[#0b1220]/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {onPreview ? <DropdownMenuItem onSelect={onPreview} className={itemClass}><Eye /> Preview</DropdownMenuItem> : null}
          <DropdownMenuItem asChild className={itemClass}><Link href={`/dashboard/files/${file.id}`}><Info /> Details</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={itemClass}><a href={`/api/files/${file.id}/download`}><Download /> Download</a></DropdownMenuItem>
          <DropdownMenuItem disabled={offlineBusy} onSelect={() => void toggleOffline()} className={itemClass}>
            {offlineReady ? <WifiOff /> : <CloudDownload />} {offlineReady ? "Remove offline copy" : "Available offline"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)} className={itemClass}><Share2 /> Share</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onSelect={() => setMode("edit")} className={itemClass}><FilePenLine /> Edit details</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("move")} className={itemClass}><FolderInput /> Move</DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={() => void toggleFavorite()} className={itemClass}><Star className={file.is_favorite ? "fill-amber-300 text-amber-300" : ""} /> {file.is_favorite ? "Remove from starred" : "Add to starred"}</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onSelect={() => setMode("trash")} className={`${itemClass} text-red-300 focus:bg-red-400/10 focus:text-red-200`}><Trash2 /> Move to Recycle Bin</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FileManagementDialog file={file} mode={mode} onClose={() => setMode(null)} />
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} shareType="file" fileId={file.id} targetName={file.title} />
    </>
  );
}

const itemClass = "min-h-10 cursor-pointer rounded-xl px-3 text-sm text-slate-300 transition-colors focus:bg-white/[0.07] focus:text-slate-100 [&_svg]:size-4 [&_svg]:text-slate-400 focus:[&_svg]:text-cyan-200";
