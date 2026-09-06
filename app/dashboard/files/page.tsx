import { AlertTriangle, ChevronRight, FolderOpen, HardDrive, SearchX } from "lucide-react";
import Link from "next/link";

import { FileGrid } from "@/components/file-grid";
import { FileList } from "@/components/file-list";
import { FilesActions } from "@/components/files-actions";
import { FilesPagination } from "@/components/files-pagination";
import { FilesToolbar } from "@/components/files-toolbar";
import { FolderCard } from "@/components/folder-card";
import { getImportantFilesBrowser } from "@/lib/files/data";
import { getMaxUploadBytes } from "@/lib/files/server";
import type { FileBrowserFilters } from "@/lib/files/types";
import { buildFileQuery, formatBytes, parseFileBrowserFilters } from "@/lib/files/utils";

type FilesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export const metadata = { title: "Important Files" };

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const filters = parseFileBrowserFilters(await searchParams);
  const maxUploadBytes = getMaxUploadBytes();
  let result: Awaited<ReturnType<typeof getImportantFilesBrowser>> | null = null;
  let loadError = "";
  try { result = await getImportantFilesBrowser(filters); } catch (error) { loadError = error instanceof Error ? error.message : "Unknown error"; }

  if (!result) return <main className="grid min-h-[68vh] place-items-center"><section className="w-full max-w-2xl rounded-[28px] border border-amber-300/25 bg-white/[0.045] p-7 shadow-sm sm:p-9"><span className="grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300"><AlertTriangle className="size-7" /></span><h1 className="mt-5 text-2xl font-semibold text-slate-100">Important Files needs server access</h1><p className="mt-3 text-sm leading-6 text-slate-400">{loadError || "The file data could not be loaded."}</p><div className="mt-5 rounded-2xl bg-white/[0.035] p-4 text-sm leading-6 text-slate-200">Confirm <code>SUPABASE_SERVICE_ROLE_KEY</code> is configured and run <code>database/phase3b_file_management.sql</code>.</div></section></main>;

  return <main className="space-y-5">
    <section className="tech-panel relative overflow-hidden rounded-[22px] p-4 sm:rounded-[28px] sm:p-8"><div className="tech-scanline" aria-hidden="true" /><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><HardDrive className="size-4" /> File management enabled</div><h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">{filters.favorite ? "Starred files" : filters.folder.split("/").at(-1) || "Important Files"}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Upload, organize, rename, move, star, preview, download, and safely recycle private files and folders.</p></div><div className="space-y-4"><FilesActions currentFolder={filters.folder} categories={result.categories} maxUploadBytes={maxUploadBytes} folderTableAvailable={result.folderTableAvailable} /><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3"><Summary label="Files" value={result.totalFiles.toLocaleString()} /><Summary label="Folders" value={result.folders.length.toLocaleString()} /><div className="col-span-2 sm:col-span-1"><Summary label="Size" value={formatBytes(result.totalBytes)} /></div></div></div></div></section>

    {!result.folderTableAvailable ? <div className="flex items-start gap-3 rounded-[18px] border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-300"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>Run <code>database/phase3b_file_management.sql</code> in Supabase to enable owner-safe folder management and the Recycle Bin.</p></div> : null}

    {!filters.favorite ? <nav aria-label="Folder breadcrumb" className="tech-panel flex items-center gap-1 overflow-x-auto rounded-[18px] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{result.breadcrumbs.map((crumb, index) => <span key={crumb.path || "root"} className="flex items-center gap-1">{index > 0 ? <ChevronRight className="size-4 shrink-0 text-slate-500" /> : null}<Link href={buildFileQuery(filters, { folder: crumb.path, page: 1 })} aria-current={index === result.breadcrumbs.length - 1 ? "page" : undefined} className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${index === result.breadcrumbs.length - 1 ? "bg-cyan-400/10 text-cyan-300" : "text-slate-400 hover:bg-white/[0.06]"}`}>{crumb.label}</Link></span>)}</nav> : null}

    <FilesToolbar filters={filters} categories={result.categories} />
    {result.truncated ? <div className="flex items-start gap-3 rounded-[18px] border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-300"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>This version loads the first 5,000 active records. Database-side pagination will replace this snapshot in a later phase.</p></div> : null}

    {result.folders.length > 0 ? <section className="space-y-3"><SectionHeading eyebrow="Directory" title="Folders" count={`${result.folders.length} folder${result.folders.length === 1 ? "" : "s"}`} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.folders.map((folder, index) => <FolderCard key={folder.path} folder={folder} filters={filters} index={index} />)}</div></section> : null}

    <section className="space-y-3"><SectionHeading eyebrow="Files" title={filters.favorite ? "Favorites" : "Files in this location"} count={`${result.totalFiles.toLocaleString()} result${result.totalFiles === 1 ? "" : "s"}`} />{result.files.length > 0 ? (filters.view === "list" ? <FileList files={result.files} /> : <FileGrid files={result.files} />) : <EmptyFiles filters={filters} />}<FilesPagination filters={filters} page={result.page} totalPages={result.totalPages} totalFiles={result.totalFiles} /></section>

    <p className="text-center text-xs text-slate-500">Data access: {result.accessMode === "service-role" ? "secure server client with owner checks" : "authenticated owner policies"}</p>
  </main>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="h-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3"><span className="block text-xs font-medium text-slate-400">{label}</span><strong className="mt-1 block truncate text-lg font-semibold text-slate-100">{value}</strong></div>; }
function SectionHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count: string }) { return <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.08em] text-slate-400">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-slate-100">{title}</h2></div><span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-400">{count}</span></div>; }
function EmptyFiles({ filters }: { filters: FileBrowserFilters }) { const filtered = Boolean(filters.q || filters.type || filters.category || filters.favorite); return <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-cyan-300/20 bg-white/[0.045] p-8 text-center"><div className="max-w-md"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">{filtered ? <SearchX className="size-7" /> : <FolderOpen className="size-7" />}</span><h3 className="mt-5 text-lg font-semibold text-slate-100">{filtered ? "No matching files" : "This location is empty"}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{filtered ? "Clear a filter or use a different search term." : "Upload files or create a folder to get started."}</p></div></div>; }
