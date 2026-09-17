"use client";

import { ModalPortal } from "@/components/ui/modal-portal";

import { AnimatePresence, motion } from "motion/react";
import {
  Download,
  Edit3,
  MoreVertical,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "@/components/ui/icons";
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
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Actions for ${video.title}`} className="grid size-9 place-items-center rounded-lg border border-white/10 bg-black/40 text-slate-300 backdrop-blur transition hover:bg-white/10 hover:text-slate-100">
        <MoreVertical className="size-5" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="tech-menu-surface absolute right-0 top-11 z-50 w-56 rounded-2xl border p-2"
          >
            {recycled ? (
              <>
                <MenuButton icon={RotateCcw} label="Restore" onClick={() => void patch({ action: "restore" })} />
                <MenuButton icon={Trash2} label="Delete permanently" danger onClick={() => { setOpen(false); setDialog("delete"); }} />
              </>
            ) : (
              <>
                <MenuButton icon={Edit3} label="Edit details" onClick={() => { setOpen(false); setDialog("edit"); }} />
                <MenuButton icon={Star} label={video.is_favorite ? "Remove from starred" : "Add to starred"} onClick={() => void patch({ action: "favorite", favorite: !video.is_favorite })} />
                <a href={`/api/videos/${video.id}/download`} className="liquid-menu-item flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-slate-300"><Download className="size-4 text-slate-400" />Download</a>
                <div className="my-1 border-t border-white/10" />
                <MenuButton icon={Trash2} label="Move to Recycle Bin" danger onClick={() => { setOpen(false); setDialog("trash"); }} />
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ModalPortal>
        <AnimatePresence>
          {dialog ? (
            <motion.div className="tech-modal-overlay fixed inset-0 z-[120] grid place-items-center overflow-y-auto p-3 sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && !busy && setDialog(null)}>
            <motion.section className="tech-modal-surface w-full max-w-lg rounded-[28px] border p-5 sm:p-6" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">{dialog === "edit" ? "Edit video details" : dialog === "trash" ? "Move video to Recycle Bin?" : "Delete video permanently?"}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{dialog === "edit" ? "Update how this video appears in your private library." : dialog === "trash" ? "You can restore this video later from the Recycle Bin." : "The database record and Supabase Storage object will be permanently removed."}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => setDialog(null)} aria-label="Close video dialog" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-slate-100"><X className="size-5" /></button>
              </div>
              {dialog === "edit" ? (
                <div className="mt-5 space-y-4">
                  <Field label="Title" value={title} onChange={setTitle} />
                  <Field label="Filename" value={originalName} onChange={setOriginalName} />
                  <Field label="Category" value={category} onChange={setCategory} placeholder="Optional" />
                  <label className="block text-sm font-medium text-slate-300">
                    Description
                    <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/15" />
                  </label>
                </div>
              ) : null}
              {error ? <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" disabled={busy} onClick={() => setDialog(null)} className="tech-interactive h-11 rounded-lg border border-white/10 bg-white/[0.04] px-5 font-semibold text-slate-300 hover:bg-white/[0.07]">Cancel</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (dialog === "edit" ? void patch({ action: "metadata", title, originalName, description, category }) : dialog === "trash" ? void patch({ action: "trash" }) : void permanentlyDelete())}
                  className={`tech-interactive h-11 rounded-lg border px-5 font-semibold text-white disabled:opacity-50 ${dialog === "edit" ? "border-primary/20 workspace-primary text-[#122f29] hover:brightness-110" : "border-red-300/20 bg-destructive/20 hover:brightness-105"}`}
                >
                  {busy ? "Working…" : dialog === "edit" ? "Save changes" : dialog === "trash" ? "Move to Recycle Bin" : "Delete permanently"}
                </button>
              </div>
            </motion.section>
          </motion.div>
          ) : null}
        </AnimatePresence>
      </ModalPortal>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, danger = false }: { icon: typeof Edit3; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`liquid-menu-item flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${danger ? "text-red-300" : "text-slate-300"}`}><Icon className="size-4" />{label}</button>;
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-300">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/15" />
    </label>
  );
}
