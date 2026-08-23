"use client";

import { Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { VideoUploadDialog } from "@/components/videos/video-upload-dialog";

export function VideoLibraryActions({ categories, maxUploadBytes }: { categories: string[]; maxUploadBytes: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2"><Link href="/dashboard/videos/recycle" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"><Trash2 className="size-4" />Recycle Bin</Link><button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"><Upload className="size-4" />Upload videos</button></div>
      <VideoUploadDialog open={open} onOpenChange={setOpen} categories={categories} maxUploadBytes={maxUploadBytes} />
    </>
  );
}
