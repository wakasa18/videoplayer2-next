import { AlertTriangle, Clock3, FileClock } from "lucide-react";

import { FileGrid } from "@/components/file-grid";
import { getRecentImportantFiles } from "@/lib/files/data";

export const metadata = { title: "Recent Files" };
export const dynamic = "force-dynamic";

export default async function RecentFilesPage() {
  try {
    const files = await getRecentImportantFiles();
    return (
      <main className="space-y-5">
        <section className="tech-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
          <div className="tech-scanline" aria-hidden="true" />
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300"><Clock3 className="size-4" /> Recently accessed</div>
          <h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">Recent files</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Files you opened, previewed, or downloaded most recently appear here automatically.</p>
        </section>
        {files.length ? <FileGrid files={files} /> : <div className="tech-panel grid min-h-72 place-items-center rounded-[26px] p-8 text-center"><div><FileClock className="mx-auto size-10 text-cyan-300" /><h2 className="mt-4 text-lg font-semibold text-slate-100">No recent files yet</h2><p className="mt-2 text-sm text-slate-400">Open or preview a file and it will appear here.</p></div></div>}
      </main>
    );
  } catch (error) {
    return <main className="grid min-h-[65vh] place-items-center"><section className="tech-panel w-full max-w-2xl rounded-[28px] p-7"><AlertTriangle className="size-8 text-amber-300" /><h1 className="mt-4 text-2xl font-semibold text-slate-100">Recent Files needs Phase 13</h1><p className="mt-3 text-sm text-slate-400">{error instanceof Error ? error.message : "Could not load recent files."}</p></section></main>;
  }
}
