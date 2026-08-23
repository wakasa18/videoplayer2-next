"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function VideosError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[65vh] place-items-center"><section className="w-full max-w-xl rounded-[28px] border border-amber-300/25 bg-white/[0.045] p-8 text-center shadow-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300"><AlertTriangle className="size-7" /></span><h1 className="mt-5 text-2xl font-semibold text-slate-100">Could not load Videos</h1><p className="mt-3 text-sm leading-6 text-slate-400">{error.message || "An unexpected error occurred."}</p><button type="button" onClick={reset} className="mx-auto mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 font-semibold text-white hover:brightness-110"><RotateCcw className="size-4" />Try again</button></section></main>;
}
