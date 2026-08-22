"use client";

import { Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { VideoUploadDialog } from "@/components/videos/video-upload-dialog";

export function VideoLibraryActions({ categories, maxUploadBytes }: { categories: string[]; maxUploadBytes: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2"><Link href="/dashboard/videos/recycle" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"><Trash2 className="size-4" />Recycle Bin</Link><button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1557b0]"><Upload className="size-4" />Upload videos</button></div>
      <VideoUploadDialog open={open} onOpenChange={setOpen} categories={categories} maxUploadBytes={maxUploadBytes} />
    </>
  );
}
