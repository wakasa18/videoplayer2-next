import { ArrowLeft, Film, Trash2 } from "lucide-react";
import Link from "next/link";

import { VideoCard } from "@/components/videos/video-card";
import { getVideosRecycleBin } from "@/lib/videos/data";
import { formatBytes } from "@/lib/videos/utils";

export const metadata = { title: "Video Recycle Bin" };

export default async function VideoRecyclePage() {
  const result = await getVideosRecycleBin();
  return (
    <main className="space-y-5">
      <section className="rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#fce8e6] px-3 py-1.5 text-xs font-semibold text-[#c5221f]"><Trash2 className="size-4" />Video Recycle Bin</div><h1 className="text-3xl font-semibold tracking-[-.03em] text-[#202124]">Deleted videos</h1><p className="mt-3 text-sm leading-6 text-[#5f6368]">Restore videos or permanently remove their database records and Supabase Storage objects.</p></div><Link href="/dashboard/videos" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"><ArrowLeft className="size-4" />Back to Videos</Link></div></section>
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-[#202124]">{result.videos.length} deleted video{result.videos.length === 1 ? "" : "s"}</h2><span className="rounded-full bg-[#f1f3f4] px-3 py-1.5 text-xs font-semibold text-[#5f6368]">{formatBytes(result.totalBytes)}</span></div>
      {result.videos.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{result.videos.map((video, index) => <VideoCard key={video.id} video={video} index={index} recycled />)}</div> : <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-[#c6dafc] bg-white p-8 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><Film className="size-7" /></span><h2 className="mt-5 text-lg font-semibold text-[#202124]">The Recycle Bin is empty</h2><p className="mt-2 text-sm text-[#5f6368]">Deleted videos will appear here.</p></div></div>}
      <p className="text-center text-xs text-[#9aa0a6]">Data access: {result.accessMode === "service-role" ? "secure server client with owner checks" : "authenticated owner policies"}</p>
    </main>
  );
}
