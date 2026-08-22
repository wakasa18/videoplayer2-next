import {
  AlertTriangle,
  Eye,
  Film,
  SearchX,
} from "lucide-react";
import Link from "next/link";

import { VideoCard } from "@/components/videos/video-card";
import { VideoItemActions } from "@/components/videos/video-item-actions";
import { VideoLibraryActions } from "@/components/videos/video-library-actions";
import { VideoToolbar } from "@/components/videos/video-toolbar";
import { getVideoBrowser } from "@/lib/videos/data";
import { getMaxVideoUploadBytes } from "@/lib/videos/server";
import type { VideoFilters, VideoRecord } from "@/lib/videos/types";
import {
  buildVideoQuery,
  formatBytes,
  formatDate,
  formatDuration,
  parseVideoFilters,
} from "@/lib/videos/utils";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export const metadata = { title: "Videos" };

export default async function VideosPage({ searchParams }: Props) {
  const filters = parseVideoFilters(await searchParams);
  const maxUploadBytes = getMaxVideoUploadBytes();
  let result: Awaited<ReturnType<typeof getVideoBrowser>> | null = null;
  let loadError = "";
  try {
    result = await getVideoBrowser(filters);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load videos.";
  }

  if (!result) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="w-full max-w-2xl rounded-[28px] border border-[#f2d6a1] bg-white p-8 shadow-sm">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#fef7e0] text-[#b06000]"><AlertTriangle className="size-7" /></span>
          <h1 className="mt-5 text-2xl font-semibold text-[#202124]">Videos needs database setup</h1>
          <p className="mt-3 text-sm leading-6 text-[#5f6368]">{loadError}</p>
          <div className="mt-5 rounded-2xl bg-[#f8f9fa] p-4 text-sm leading-6 text-[#3c4043]">Run <code>database/phase6_videos.sql</code>, create the private video bucket, and configure <code>SUPABASE_VIDEOS_BUCKET</code>.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#1967d2]"><Film className="size-4" />Private video library</div>
            <h1 className="text-3xl font-semibold tracking-[-.03em] text-[#202124] sm:text-4xl">{filters.favorite ? "Starred videos" : "Videos"}</h1>
            <p className="mt-3 text-sm leading-6 text-[#5f6368] sm:text-base">Upload, stream, organize, download, and safely recycle private videos stored in Supabase.</p>
          </div>
          <div className="space-y-4">
            <VideoLibraryActions categories={result.categories} maxUploadBytes={maxUploadBytes} />
            <div className="grid grid-cols-3 gap-3"><Summary label="Videos" value={result.totalVideos.toLocaleString()} /><Summary label="Storage" value={formatBytes(result.totalBytes)} /><Summary label="Views" value={result.totalViews.toLocaleString()} /></div>
          </div>
        </div>
      </section>

      <VideoToolbar filters={filters} categories={result.categories} />
      {result.truncated ? <div className="flex items-start gap-3 rounded-[18px] border border-[#f2d6a1] bg-[#fef7e0] p-4 text-sm text-[#8d4e00]"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>This version loads the first 5,000 active videos. Database-side pagination can be added later for larger libraries.</p></div> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#80868b]">Library</p><h2 className="mt-1 text-lg font-semibold text-[#202124]">{filters.favorite ? "Favorites" : "All videos"}</h2></div><span className="rounded-full bg-[#f1f3f4] px-3 py-1.5 text-xs font-semibold text-[#5f6368]">{result.totalVideos} result{result.totalVideos === 1 ? "" : "s"}</span></div>
        {result.videos.length ? (
          filters.view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{result.videos.map((video, index) => <VideoCard key={video.id} video={video} index={index} />)}</div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-[#e1e5ea] bg-white shadow-sm">{result.videos.map((video, index) => <VideoListRow key={video.id} video={video} index={index} />)}</div>
          )
        ) : <EmptyState filtered={Boolean(filters.q || filters.category || filters.favorite)} />}
        <Pagination filters={filters} page={result.page} totalPages={result.totalPages} />
      </section>
      <p className="text-center text-xs text-[#9aa0a6]">Data access: {result.accessMode === "service-role" ? "secure server client with owner checks" : "authenticated owner policies"}</p>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-24 rounded-2xl border border-[#e1e5ea] bg-[#f8f9fa] px-4 py-3"><span className="block text-xs font-medium text-[#80868b]">{label}</span><strong className="mt-1 block truncate text-lg font-semibold text-[#202124]">{value}</strong></div>;
}
function VideoListRow({ video }: { video: VideoRecord; index: number }) {
  return <article className="flex items-center gap-4 border-b border-[#eef1f3] p-4 last:border-b-0 hover:bg-[#f8f9fa]"><Link href={`/dashboard/videos/${video.id}`} className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><Film className="size-6" /></Link><Link href={`/dashboard/videos/${video.id}`} className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-[#202124]">{video.title}</h3><p className="mt-1 truncate text-xs text-[#80868b]">{video.original_filename}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5f6368]"><span>{formatBytes(video.file_size)}</span><span>{formatDuration(video.duration_seconds)}</span><span>{formatDate(video.created_at)}</span><span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{video.view_count}</span></div></Link><VideoItemActions video={video} /></article>;
}
function EmptyState({ filtered }: { filtered: boolean }) {
  return <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-[#c6dafc] bg-white p-8 text-center"><div className="max-w-md"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">{filtered ? <SearchX className="size-7" /> : <Film className="size-7" />}</span><h3 className="mt-5 text-lg font-semibold text-[#202124]">{filtered ? "No matching videos" : "Your video library is empty"}</h3><p className="mt-2 text-sm leading-6 text-[#5f6368]">{filtered ? "Clear a filter or try a different search term." : "Upload your first private video to begin."}</p></div></div>;
}
function Pagination({ filters, page, totalPages }: { filters: VideoFilters; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages].filter((value) => value >= 1 && value <= totalPages))).sort((a, b) => a - b);
  return <nav aria-label="Video pages" className="flex flex-wrap justify-center gap-2 pt-3">{page > 1 ? <Link href={buildVideoQuery(filters, { page: page - 1 })} className="rounded-full border border-[#dadce0] bg-white px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]">Previous</Link> : null}{pages.map((value) => <Link key={value} href={buildVideoQuery(filters, { page: value })} aria-current={value === page ? "page" : undefined} className={`grid min-w-10 place-items-center rounded-full px-3 py-2 text-sm font-semibold ${value === page ? "bg-[#1a73e8] text-white" : "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"}`}>{value}</Link>)}{page < totalPages ? <Link href={buildVideoQuery(filters, { page: page + 1 })} className="rounded-full border border-[#dadce0] bg-white px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]">Next</Link> : null}</nav>;
}
