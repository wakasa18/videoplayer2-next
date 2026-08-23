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
      <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300"><Trash2 className="size-4" />Video Recycle Bin</div><h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100">Deleted videos</h1><p className="mt-3 text-sm leading-6 text-slate-400">Restore videos or permanently remove their database records and Supabase Storage objects.</p></div><Link href="/dashboard/videos" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"><ArrowLeft className="size-4" />Back to Videos</Link></div></section>
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-100">{result.videos.length} deleted video{result.videos.length === 1 ? "" : "s"}</h2><span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-400">{formatBytes(result.totalBytes)}</span></div>
      {result.videos.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{result.videos.map((video, index) => <VideoCard key={video.id} video={video} index={index} recycled />)}</div> : <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-cyan-300/20 bg-white/[0.045] p-8 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Film className="size-7" /></span><h2 className="mt-5 text-lg font-semibold text-slate-100">The Recycle Bin is empty</h2><p className="mt-2 text-sm text-slate-400">Deleted videos will appear here.</p></div></div>}
      <p className="text-center text-xs text-slate-500">Data access: {result.accessMode === "service-role" ? "secure server client with owner checks" : "authenticated owner policies"}</p>
    </main>
  );
}
