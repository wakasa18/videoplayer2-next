import { ArrowLeft, Film } from "lucide-react";
import Link from "next/link";

export default function VideoNotFound() {
  return <main className="grid min-h-[65vh] place-items-center"><section className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Film className="size-7" /></span><h1 className="mt-5 text-2xl font-semibold text-slate-100">Video not found</h1><p className="mt-3 text-sm leading-6 text-slate-400">It may have been removed, recycled, or belongs to another account.</p><Link href="/dashboard/videos" className="mx-auto mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 font-semibold text-white hover:brightness-110"><ArrowLeft className="size-4" />Back to Videos</Link></section></main>;
}
