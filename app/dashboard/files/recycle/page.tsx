import { ArrowLeft, Folder, Recycle, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { FileTypeIcon } from "@/components/file-type-icon";
import { RecycleItemActions } from "@/components/recycle-item-actions";
import { getImportantFilesRecycleBin } from "@/lib/files/data";
import { formatBytes, formatDate } from "@/lib/files/utils";

export const metadata = { title: "Recycle Bin · Important Files" };

export default async function RecycleBinPage() {
  let result: Awaited<ReturnType<typeof getImportantFilesRecycleBin>> | null = null;
  let error = "";
  try { result = await getImportantFilesRecycleBin(); } catch (reason) { error = reason instanceof Error ? reason.message : "Could not load the Recycle Bin."; }

  if (!result) return <main className="grid min-h-[65vh] place-items-center"><section className="w-full max-w-xl rounded-[28px] border border-[#f2d6a1] bg-white p-7 shadow-sm"><ShieldAlert className="size-10 text-[#b06000]" /><h1 className="mt-5 text-2xl font-semibold text-[#202124]">Recycle Bin unavailable</h1><p className="mt-3 text-sm leading-6 text-[#5f6368]">{error}</p><p className="mt-4 rounded-2xl bg-[#f8f9fa] p-4 text-sm text-[#3c4043]">Run <code>database/phase3b_file_management.sql</code> in Supabase, then restart the app.</p></section></main>;

  const empty = result.files.length === 0 && result.folders.length === 0;
  return <main className="space-y-5">
    <section className="rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#fce8e6] px-3 py-1.5 text-xs font-semibold text-[#c5221f]"><Recycle className="size-4" /> Recoverable items</div><h1 className="text-3xl font-semibold tracking-[-.03em] text-[#202124] sm:text-4xl">Recycle Bin</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6368] sm:text-base">Restore files and folders, or remove them permanently. Permanent deletion also removes private Storage objects.</p></div><Link href="/dashboard/files" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"><ArrowLeft className="size-4" /> Back to files</Link></div><div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-3"><Summary label="Files" value={result.files.length.toLocaleString()} /><Summary label="Folders" value={result.folders.length.toLocaleString()} /><Summary label="Total size" value={formatBytes(result.totalBytes)} /></div></section>

    {!result.folderTableAvailable ? <div className="rounded-[18px] border border-[#f2d6a1] bg-[#fef7e0] p-4 text-sm text-[#8d4e00]">Run <code>database/phase3b_file_management.sql</code> to enable folder restore and deletion.</div> : null}

    {empty ? <div className="grid min-h-80 place-items-center rounded-[28px] border border-dashed border-[#c6dafc] bg-white p-8 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><Recycle className="size-8" /></span><h2 className="mt-5 text-xl font-semibold text-[#202124]">Recycle Bin is empty</h2><p className="mt-2 text-sm text-[#5f6368]">Deleted files and folders will appear here.</p></div></div> : null}

    {result.folders.length ? <section className="space-y-3"><div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#80868b]">Deleted folders</p><h2 className="mt-1 text-lg font-semibold text-[#202124]">Folder groups</h2></div><div className="space-y-3">{result.folders.map((folder) => <article key={folder.path} className="flex flex-col gap-4 rounded-[22px] border border-[#e1e5ea] bg-white p-4 shadow-sm sm:flex-row sm:items-center"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fef7e0] text-[#a15c00]"><Folder className="size-6 fill-current" /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-[#202124]">{folder.name}</h3><p className="mt-1 truncate text-xs text-[#80868b]">{folder.path}</p><p className="mt-1 text-xs text-[#9aa0a6]">{folder.fileCount} file{folder.fileCount === 1 ? "" : "s"} · {formatBytes(folder.totalBytes)} · Deleted {formatDate(folder.deletedAt ?? null)}</p></div><RecycleItemActions kind="folder" path={folder.path} title={folder.name} /></article>)}</div></section> : null}

    {result.files.length ? <section className="space-y-3"><div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#80868b]">Deleted files</p><h2 className="mt-1 text-lg font-semibold text-[#202124]">Individual files</h2></div><div className="overflow-hidden rounded-[22px] border border-[#e1e5ea] bg-white shadow-sm"><div className="divide-y divide-[#eef1f3]">{result.files.map((file) => <article key={file.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><FileTypeIcon file={file} className="size-11 rounded-xl" iconClassName="size-5" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-[#202124]">{file.title}</h3><p className="mt-1 truncate text-xs text-[#80868b]">{file.original_filename}</p><p className="mt-1 text-xs text-[#9aa0a6]">{formatBytes(file.file_size)} · Deleted {formatDate(file.deleted_at)}</p></div><RecycleItemActions kind="file" id={file.id} title={file.title} /></article>)}</div></div></section> : null}

    <p className="text-center text-xs text-[#9aa0a6]">Data access: {result.accessMode === "service-role" ? "secure server client" : "authenticated owner policies"}</p>
  </main>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#e1e5ea] bg-[#f8f9fa] px-4 py-3"><span className="block text-xs font-medium text-[#80868b]">{label}</span><strong className="mt-1 block truncate text-lg font-semibold text-[#202124]">{value}</strong></div>; }
