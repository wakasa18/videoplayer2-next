"use client";

import { motion } from "motion/react";
import { Eye, Film, Star } from "lucide-react";
import Link from "next/link";

import { VideoItemActions } from "@/components/videos/video-item-actions";
import type { VideoRecord } from "@/lib/videos/types";
import { formatBytes, formatDate, formatDuration } from "@/lib/videos/utils";

export function VideoCard({ video, index = 0, recycled = false }: { video: VideoRecord; index?: number; recycled?: boolean }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index * 0.035, 0.28), type: "spring", stiffness: 260, damping: 24 }}
      className="tech-panel tech-interactive group relative overflow-hidden rounded-[24px] text-card-foreground"
    >
      <Link href={recycled ? "/dashboard/videos/recycle" : `/dashboard/videos/${video.id}`} className="block">
        <div className="relative grid aspect-video place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(233,92,255,0.14),transparent_45%),linear-gradient(150deg,#1a1030_0%,#0a0f21_60%,#081321_100%)]">
          <div className="tech-scanline" aria-hidden="true" />
          <motion.span
            whileHover={{ scale: 1.08, rotate: -3 }}
            className="grid size-16 place-items-center rounded-[22px] border border-white/15 bg-white/10 text-cyan-200 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur"
          >
            <Film className="size-8" />
          </motion.span>
          <span className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            {formatDuration(video.duration_seconds)}
          </span>
          {video.is_favorite ? (
            <span className="absolute left-3 top-3 grid size-9 place-items-center rounded-full border border-white/10 bg-black/50 text-amber-300 shadow-sm backdrop-blur">
              <Star className="size-4 fill-current" />
            </span>
          ) : null}
        </div>
        <div className="p-4 pr-12">
          <h2 className="truncate text-sm font-semibold text-slate-100">{video.title}</h2>
          <p className="mt-1 truncate text-xs text-slate-400">{video.original_filename}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{formatBytes(video.file_size)}</span>
            <span>{formatDate(video.created_at)}</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" />
              {video.view_count}
            </span>
          </div>
        </div>
      </Link>
      <div className="absolute bottom-3 right-3">
        <VideoItemActions video={video} recycled={recycled} />
      </div>
    </motion.article>
  );
}
