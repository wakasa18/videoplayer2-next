"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileCheck2,
  Folder,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FileTypeIcon } from "@/components/file-type-icon";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, formatDate, getFileType } from "@/lib/files/utils";
import type { PublicShareFile, PublicShareResult } from "@/lib/shares/types";

type Props = {
  token: string;
  result: PublicShareResult;
  publicUrl: string;
};

export function PublicShareBrowser({ token, result, publicUrl }: Props) {
  const [previewFile, setPreviewFile] = useState<PublicShareFile | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const isFolder = result.share.share_type === "folder";
  const allowDownloads = result.share.allow_downloads;
  const qrUrl = useMemo(
    () =>
      publicUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(publicUrl)}`
        : "",
    [publicUrl],
  );

  function toggleFile(fileId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  async function copyPageLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function downloadSelected() {
    if (!selected.size || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/public-shares/${encodeURIComponent(token)}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: result.currentFolder,
          fileIds: [...selected],
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not create the ZIP download.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = decodeFilename(disposition) || "selected-files.zip";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSelected(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not download selected files.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f1f3f4] text-[#202124]">
      <header className="sticky top-0 z-40 border-b border-[#dadce0] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1a73e8] to-[#5e97f6] text-white shadow-sm">
            <LockKeyhole className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-semibold sm:text-base">Damon&apos;s Archive</strong>
            <span className="block text-xs text-[#80868b]">Secure public share</span>
          </div>
          <button
            type="button"
            onClick={() => void copyPageLink()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQr((value) => !value)}
            className="grid size-10 place-items-center rounded-full border border-[#dadce0] bg-white text-[#3c4043] transition hover:bg-[#f8f9fa]"
            aria-label="Show QR code"
          >
            <QrCode className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e6f4ea] px-3 py-1.5 text-xs font-semibold text-[#137333]">
                <ShieldCheck className="size-4" /> Verified shared link
              </div>
              <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-.03em] sm:text-4xl">{result.targetName}</h1>
              {result.share.display_name ? <p className="mt-2 text-sm font-medium text-[#5f6368]">Shared by {result.share.display_name}</p> : null}
              {result.share.share_message ? <p className="mt-4 max-w-3xl whitespace-pre-wrap rounded-2xl bg-[#f8f9fa] p-4 text-sm leading-6 text-[#5f6368]">{result.share.share_message}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Files" value={result.totalFiles.toLocaleString()} />
              <Stat label="Size" value={formatBytes(result.totalBytes)} />
              <Stat label="Access" value={allowDownloads ? "Preview + download" : "Preview only"} wide />
            </div>
          </div>
        </section>

        <AnimatePresence>
          {showQr && qrUrl ? (
            <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col items-center rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} width={260} height={260} alt="QR code for this shared link" className="rounded-xl" />
              <p className="mt-3 text-center text-xs text-[#80868b]">QR rendering uses api.qrserver.com.</p>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {isFolder ? (
          <nav className="flex items-center gap-1 overflow-x-auto rounded-[18px] border border-[#e1e5ea] bg-white px-3 py-2 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Shared folder breadcrumb">
            {result.breadcrumbs.map((crumb, index) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-4 shrink-0 text-[#9aa0a6]" /> : null}
                <Link href={sharePath(token, crumb.path)} aria-current={index === result.breadcrumbs.length - 1 ? "page" : undefined} className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${index === result.breadcrumbs.length - 1 ? "bg-[#e8f0fe] text-[#1967d2]" : "text-[#5f6368] hover:bg-[#f1f3f4]"}`}>{crumb.label}</Link>
              </span>
            ))}
          </nav>
        ) : null}

        {error ? <div className="rounded-2xl border border-[#f6c7c3] bg-[#fce8e6] p-4 text-sm text-[#a50e0e]">{error}</div> : null}

        {isFolder && allowDownloads ? (
          <section className="flex flex-col gap-3 rounded-[20px] border border-[#d2e3fc] bg-[#e8f0fe] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-[#1967d2]"><FileCheck2 className="size-5" /></span>
              <div><strong className="block text-sm text-[#174ea6]">{selected.size ? `${selected.size} selected` : "Select files to download together"}</strong><small className="mt-1 block text-xs text-[#4b6fae]">ZIP downloads support up to 100 files and 250 MB.</small></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.size ? <button type="button" onClick={() => setSelected(new Set())} className="min-h-10 rounded-full border border-[#8ab4f8] bg-white px-4 text-sm font-semibold text-[#1967d2]">Clear</button> : null}
              <button type="button" disabled={!selected.size || downloading} onClick={() => void downloadSelected()} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white transition hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-50"><ArrowDownToLine className="size-4" /> {downloading ? "Preparing…" : "Download selected"}</button>
              <a href={`/api/public-shares/${encodeURIComponent(token)}/archive?path=${encodeURIComponent(result.currentFolder)}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#8ab4f8] bg-white px-4 text-sm font-semibold text-[#1967d2] transition hover:bg-[#f8fbff]"><Download className="size-4" /> Download folder</a>
            </div>
          </section>
        ) : null}

        {result.folders.length ? (
          <section className="space-y-3">
            <SectionTitle title="Folders" count={result.folders.length} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.folders.map((folder, index) => (
                <motion.article key={folder.path} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * .035 }} className="rounded-[22px] border border-[#e1e5ea] bg-white shadow-sm transition hover:border-[#c6dafc] hover:shadow-md">
                  <Link href={sharePath(token, folder.path)} className="group flex min-h-28 items-center gap-4 p-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2] transition group-hover:scale-105"><Folder className="size-6 fill-current" /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{folder.name}</strong><small className="mt-1 block text-xs text-[#80868b]">{folder.fileCount.toLocaleString()} file{folder.fileCount === 1 ? "" : "s"} · {formatBytes(folder.totalBytes)}</small></span>
                    <ChevronRight className="size-5 text-[#9aa0a6] transition group-hover:translate-x-0.5 group-hover:text-[#1967d2]" />
                  </Link>
                </motion.article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionTitle title={isFolder ? "Files in this location" : "Shared file"} count={result.files.length} />
          {result.files.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.files.map((file, index) => {
                const full = asImportantFile(file);
                const previewable = canPreviewFile(full);
                return (
                  <motion.article key={file.id} initial={{ opacity: 0, y: 14, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(index, 18) * .03 }} className={`relative overflow-hidden rounded-[22px] border bg-white shadow-sm transition hover:border-[#c6dafc] hover:shadow-md ${selected.has(file.id) ? "border-[#8ab4f8] ring-4 ring-[#e8f0fe]" : "border-[#e1e5ea]"}`}>
                    {isFolder && allowDownloads ? <label className="absolute left-3 top-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-white shadow-md"><input type="checkbox" checked={selected.has(file.id)} onChange={() => toggleFile(file.id)} className="size-4 accent-[#1a73e8]" aria-label={`Select ${file.title}`} /></label> : null}
                    <button type="button" disabled={!previewable} onClick={() => previewable && setPreviewFile(file)} className="flex min-h-32 w-full flex-col items-center justify-center bg-gradient-to-br from-[#f8f9fa] to-[#eef3fd] p-5 disabled:cursor-default">
                      <FileTypeIcon file={full} className="size-16 rounded-[20px] shadow-sm" iconClassName="size-8" />
                      <span className="mt-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-[#80868b] shadow-sm">{(file.file_extension || "FILE").toUpperCase()}</span>
                    </button>
                    <div className="border-t border-[#eef1f3] p-4">
                      <h3 className="truncate text-sm font-semibold">{file.title}</h3>
                      <p className="mt-1 truncate text-xs text-[#80868b]">{formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {previewable ? <button type="button" onClick={() => setPreviewFile(file)} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#dadce0] px-3 text-xs font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"><Eye className="size-3.5" /> Preview</button> : null}
                        {allowDownloads ? <a href={`/api/public-shares/${encodeURIComponent(token)}/files/${file.id}/download`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#1a73e8] px-3 text-xs font-semibold text-white hover:bg-[#1557b0]"><Download className="size-3.5" /> Download</a> : null}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-60 place-items-center rounded-[24px] border border-dashed border-[#c6dafc] bg-white p-8 text-center"><div><Folder className="mx-auto size-10 text-[#1967d2]" /><h3 className="mt-4 font-semibold">This folder is empty</h3><p className="mt-2 text-sm text-[#5f6368]">There are no shared files in this location.</p></div></div>
          )}
        </section>

        <footer className="flex items-center justify-center gap-2 py-4 text-xs text-[#80868b]"><ShieldCheck className="size-4" /> Files are served through temporary private Storage URLs.</footer>
      </main>

      <PublicPreview token={token} file={previewFile} allowDownloads={allowDownloads} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

function PublicPreview({ token, file, allowDownloads, onClose }: { token: string; file: PublicShareFile | null; allowDownloads: boolean; onClose: () => void }) {
  const full = file ? asImportantFile(file) : null;
  const type = full ? getFileType(full) : "other";
  const previewUrl = file ? `/api/public-shares/${encodeURIComponent(token)}/files/${file.id}/preview` : "";
  return (
    <AnimatePresence>
      {file && full ? (
        <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-[#202124]/55 p-3 backdrop-blur-sm sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
          <motion.section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-2xl" initial={{ opacity: 0, y: 24, scale: .975 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
            <header className="flex items-center gap-3 border-b border-[#e1e5ea] px-4 py-3 sm:px-5"><FileTypeIcon file={full} className="size-10 rounded-xl" iconClassName="size-5" /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold sm:text-base">{file.title}</h2><p className="truncate text-xs text-[#80868b]">{file.original_filename} · {formatBytes(file.file_size)}</p></div>{allowDownloads ? <a href={`/api/public-shares/${encodeURIComponent(token)}/files/${file.id}/download`} className="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]" aria-label="Download file"><Download className="size-5" /></a> : null}<button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]" aria-label="Close preview"><X className="size-5" /></button></header>
            <div className="min-h-0 flex-1 bg-[#f1f3f4] p-2 sm:p-4">{renderPreview(type, previewUrl, file)}</div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function renderPreview(type: ReturnType<typeof getFileType>, url: string, file: PublicShareFile) {
  const frame = "h-[min(72vh,760px)] min-h-[420px]";
  if (type === "image") return <div className={`grid ${frame} place-items-center overflow-auto rounded-2xl bg-[#eef1f5] p-4`}><Image unoptimized src={url} alt={file.title} width={1600} height={1200} className="max-h-full h-auto max-w-full rounded-xl bg-white object-contain shadow-lg" /></div>;
  if (type === "video") return <div className={`grid ${frame} place-items-center overflow-hidden rounded-2xl bg-black p-2`}><video controls preload="metadata" className="max-h-full max-w-full rounded-xl" src={url}>Your browser cannot play this video.</video></div>;
  if (type === "audio") return <div className={`grid ${frame} place-items-center rounded-2xl bg-white p-8`}><audio controls preload="metadata" className="w-full max-w-xl" src={url}>Your browser cannot play this audio file.</audio></div>;
  if (type === "pdf" || type === "text") return <iframe title={`Preview ${file.title}`} src={url} className={`w-full ${frame} rounded-2xl border border-[#dadce0] bg-white`} />;
  return <div className={`grid ${frame} place-items-center rounded-2xl bg-white p-8 text-center`}><p className="text-sm text-[#5f6368]">Preview is not available for this file type.</p></div>;
}

function asImportantFile(file: PublicShareFile): ImportantFile {
  return {
    ...file,
    owner_id: "public-share",
    status: "active",
    expires_at: null,
    is_favorite: false,
    download_count: 0,
    deleted_at: null,
  };
}

function sharePath(token: string, path: string): string {
  return `/share/${encodeURIComponent(token)}?path=${encodeURIComponent(path)}`;
}

function decodeFilename(disposition: string): string | null {
  const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf) return decodeURIComponent(utf);
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? null;
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-2xl border border-[#e1e5ea] bg-[#f8f9fa] px-4 py-3 ${wide ? "col-span-2 sm:col-span-1" : ""}`}><span className="block text-xs font-medium text-[#80868b]">{label}</span><strong className="mt-1 block truncate text-sm font-semibold text-[#202124] sm:text-base">{value}</strong></div>;
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><span className="rounded-full bg-[#e8eaed] px-3 py-1.5 text-xs font-semibold text-[#5f6368]">{count.toLocaleString()}</span></div>;
}
