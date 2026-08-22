import {
  ArrowLeft,
  CalendarDays,
  Download,
  Eye,
  FileVideo,
  HardDrive,
  Star,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VideoItemActions } from "@/components/videos/video-item-actions";
import { VideoPlayer } from "@/components/videos/video-player";
import { getVideoById } from "@/lib/videos/data";
import { formatBytes, formatDate, formatDuration } from "@/lib/videos/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return { title: "Video" };
  try {
    const { video } = await getVideoById(id);
    return { title: video?.title ?? "Video" };
  } catch {
    return { title: "Video" };
  }
}

export default async function VideoDetailsPage({ params }: Props) {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id < 1) notFound();
  const { video, accessMode, storageAvailable } = await getVideoById(id, { checkStorage: true });
  if (!video) notFound();

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/dashboard/videos" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"><ArrowLeft className="size-4" />Back to Videos</Link><div className="flex items-center gap-2">{storageAvailable ? <a href={`/api/videos/${video.id}/download`} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white hover:bg-[#1557b0]"><Download className="size-4" />Download</a> : null}<VideoItemActions video={video} /></div></div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.65fr)]">
        <div className="space-y-4"><VideoPlayer id={video.id} title={video.title} filename={video.original_filename} mimeType={video.mime_type} initialMissing={storageAvailable === false} /><section className="rounded-[24px] border border-[#e1e5ea] bg-white p-6 shadow-sm"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><FileVideo className="size-6" /></span><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><h1 className="min-w-0 flex-1 break-words text-2xl font-semibold tracking-[-.02em] text-[#202124]">{video.title}</h1>{video.is_favorite ? <Star className="mt-1 size-5 shrink-0 fill-[#f9ab00] text-[#f9ab00]" /> : null}</div><p className="mt-2 break-all text-sm text-[#80868b]">{video.original_filename}</p>{video.description ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#5f6368]">{video.description}</p> : null}</div></div></section></div>
        <aside className="space-y-4"><section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm"><h2 className="text-base font-semibold text-[#202124]">Video information</h2><div className="mt-4 grid gap-3"><Info icon={HardDrive} label="File size" value={formatBytes(video.file_size)} /><Info icon={CalendarDays} label="Uploaded" value={formatDate(video.created_at)} /><Info icon={Eye} label="Views" value={video.view_count.toLocaleString()} /><Info icon={Download} label="Downloads" value={video.download_count.toLocaleString()} /><Info icon={FileVideo} label="Duration" value={formatDuration(video.duration_seconds)} /><Info icon={FileVideo} label="Category" value={video.category || "Uncategorized"} /></div></section><section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 text-xs leading-5 text-[#80868b] shadow-sm">Data access: {accessMode === "service-role" ? "secure server client with owner checks" : "authenticated owner policies"}</section></aside>
      </section>
    </main>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9fa] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#1967d2] shadow-sm"><Icon className="size-4" /></span><div className="min-w-0"><span className="block text-xs text-[#80868b]">{label}</span><strong className="mt-0.5 block truncate text-sm font-semibold text-[#3c4043]">{value}</strong></div></div>;
}
