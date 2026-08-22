"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Download,
  Edit3,
  MoreVertical,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { VideoRecord } from "@/lib/videos/types";

type Props = { video: VideoRecord; recycled?: boolean };

export function VideoItemActions({ video, recycled = false }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "trash" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(video.title);
  const [originalName, setOriginalName] = useState(video.original_filename);
  const [description, setDescription] = useState(video.description ?? "");
  const [category, setCategory] = useState(video.category ?? "");

  useEffect(() => {
    if (!open) return;
    const listener = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [open]);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update video.");
      setOpen(false);
      setDialog(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update video.");
    } finally {
      setBusy(false);
    }
  }

  async function permanentlyDelete() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not delete video.");
      setDialog(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete video.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative z-20">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Actions for ${video.title}`} className="grid size-9 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"><MoreVertical className="size-5" /></button>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-[#dadce0] bg-white p-2 shadow-[0_8px_24px_rgba(60,64,67,.2)]">
            {recycled ? (
              <>
                <MenuButton icon={RotateCcw} label="Restore" onClick={() => void patch({ action: "restore" })} />
                <MenuButton icon={Trash2} label="Delete permanently" danger onClick={() => { setOpen(false); setDialog("delete"); }} />
              </>
            ) : (
              <>
                <MenuButton icon={Edit3} label="Edit details" onClick={() => { setOpen(false); setDialog("edit"); }} />
                <MenuButton icon={Star} label={video.is_favorite ? "Remove from starred" : "Add to starred"} onClick={() => void patch({ action: "favorite", favorite: !video.is_favorite })} />
                <a href={`/api/videos/${video.id}/download`} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-[#3c4043] hover:bg-[#f1f3f4]"><Download className="size-4" />Download</a>
                <div className="my-1 border-t border-[#eef1f3]" />
                <MenuButton icon={Trash2} label="Move to Recycle Bin" danger onClick={() => { setOpen(false); setDialog("trash"); }} />
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dialog ? (
          <motion.div className="fixed inset-0 z-[120] grid place-items-center bg-[#202124]/45 p-4 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && !busy && setDialog(null)}>
            <motion.section className="w-full max-w-lg rounded-[28px] border border-[#dadce0] bg-white p-6 shadow-[0_20px_60px_rgba(32,33,36,.28)]" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-[#202124]">{dialog === "edit" ? "Edit video details" : dialog === "trash" ? "Move video to Recycle Bin?" : "Delete video permanently?"}</h2><p className="mt-2 text-sm leading-6 text-[#5f6368]">{dialog === "edit" ? "Update how this video appears in your private library." : dialog === "trash" ? "You can restore this video later from the Recycle Bin." : "The database record and Supabase Storage object will be permanently removed."}</p></div><button type="button" disabled={busy} onClick={() => setDialog(null)} className="grid size-9 shrink-0 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"><X className="size-5" /></button></div>
              {dialog === "edit" ? <div className="mt-5 space-y-4"><Field label="Title" value={title} onChange={setTitle} /><Field label="Filename" value={originalName} onChange={setOriginalName} /><Field label="Category" value={category} onChange={setCategory} placeholder="Optional" /><label className="block text-sm font-medium text-[#3c4043]">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-[#dadce0] px-4 py-3 outline-none focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]" /></label></div> : null}
              {error ? <p className="mt-4 rounded-2xl bg-[#fce8e6] p-3 text-sm text-[#a50e0e]">{error}</p> : null}
              <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setDialog(null)} className="h-11 rounded-full border border-[#dadce0] px-5 font-semibold text-[#3c4043] hover:bg-[#f8f9fa]">Cancel</button><button type="button" disabled={busy} onClick={() => dialog === "edit" ? void patch({ action: "metadata", title, originalName, description, category }) : dialog === "trash" ? void patch({ action: "trash" }) : void permanentlyDelete()} className={`h-11 rounded-full px-5 font-semibold text-white disabled:opacity-50 ${dialog === "edit" ? "bg-[#1a73e8] hover:bg-[#1557b0]" : "bg-[#d93025] hover:bg-[#b3261e]"}`}>{busy ? "Working…" : dialog === "edit" ? "Save changes" : dialog === "trash" ? "Move to Recycle Bin" : "Delete permanently"}</button></div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, danger = false }: { icon: typeof Edit3; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-[#f1f3f4] ${danger ? "text-[#c5221f]" : "text-[#3c4043]"}`}><Icon className="size-4" />{label}</button>;
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block text-sm font-medium text-[#3c4043]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-2xl border border-[#dadce0] px-4 outline-none focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]" /></label>;
}
