"use client";

import { motion } from "motion/react";
import { Eye, Film, Star } from "lucide-react";
import Link from "next/link";

import { VideoItemActions } from "@/components/videos/video-item-actions";
import type { VideoRecord } from "@/lib/videos/types";
import { formatBytes, formatDate, formatDuration } from "@/lib/videos/utils";

export function VideoCard({ video, index = 0, recycled = false }: { video: VideoRecord; index?: number; recycled?: boolean }) {
  return (
    <motion.article initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(index * 0.035, 0.28), type: "spring", stiffness: 270, damping: 25 }} className="group relative overflow-hidden rounded-[24px] border border-[#e1e5ea] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#c6dafc] hover:shadow-md">
      <Link href={recycled ? "/dashboard/videos/recycle" : `/dashboard/videos/${video.id}`} className="block">
        <div className="relative grid aspect-video place-items-center overflow-hidden bg-gradient-to-br from-[#e8f0fe] via-[#f3f7ff] to-[#d2e3fc]">
          <motion.span whileHover={{ scale: 1.06, rotate: -2 }} className="grid size-16 place-items-center rounded-[22px] bg-white/85 text-[#1967d2] shadow-sm backdrop-blur"><Film className="size-8" /></motion.span>
          <span className="absolute bottom-3 right-3 rounded-full bg-[#202124]/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{formatDuration(video.duration_seconds)}</span>
          {video.is_favorite ? <span className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-[#f9ab00] shadow-sm"><Star className="size-4 fill-current" /></span> : null}
        </div>
        <div className="p-4 pr-12"><h2 className="truncate text-sm font-semibold text-[#202124]">{video.title}</h2><p className="mt-1 truncate text-xs text-[#80868b]">{video.original_filename}</p><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5f6368]"><span>{formatBytes(video.file_size)}</span><span>{formatDate(video.created_at)}</span><span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{video.view_count}</span></div></div>
      </Link>
      <div className="absolute bottom-3 right-3"><VideoItemActions video={video} recycled={recycled} /></div>
    </motion.article>
  );
}
