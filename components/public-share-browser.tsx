"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  Eye,
  FileCheck2,
  Folder,
  Grid2X2,
  Info,
  Link2,
  List,
  LockKeyhole,
  Mail,
  MoreVertical,
  QrCode,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FileTypeIcon } from "@/components/file-type-icon";
import type { ImportantFile } from "@/lib/files/types";
import {
  canPreviewFile,
  formatBytes,
  formatDate,
  getFileType,
} from "@/lib/files/utils";
import type { PublicShareFile, PublicShareResult } from "@/lib/shares/types";

type Props = {
  token: string;
  result: PublicShareResult;
  publicUrl: string;
  archiveLimits: { maxFiles: number; maxBytes: number };
  supportEmail: string | null;
};

type FileFilter =
  | "all"
  | "documents"
  | "archives"
  | "images"
  | "videos"
  | "audio"
  | "other";
type FileSort =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "size-asc"
  | "size-desc";
type ViewMode = "grid" | "list";
type DownloadPlan = {
  kind: "selected" | "folder";
  count: number;
  bytes: number;
} | null;

export function PublicShareBrowser({
  token,
  result,
  publicUrl,
  archiveLimits,
  supportEmail,
}: Props) {
  const [previewFile, setPreviewFile] = useState<PublicShareFile | null>(null);
  const [infoFile, setInfoFile] = useState<PublicShareFile | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
  const [downloadPlan, setDownloadPlan] = useState<DownloadPlan>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState<number | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileFilter>("all");
  const [sort, setSort] = useState<FileSort>("name-asc");
  const [view, setView] = useState<ViewMode>("grid");

  const isFolder = result.share.share_type === "folder";
  const allowDownloads = result.share.allow_downloads;
  const origin = safeOrigin(publicUrl);
  const host = safeHost(publicUrl);
  const qrUrl = useMemo(
    () =>
      publicUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=${encodeURIComponent(publicUrl)}`
        : "",
    [publicUrl],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredFolders = useMemo(
    () =>
      result.folders.filter((folder) =>
        normalizedQuery
          ? `${folder.name} ${folder.path}`
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          : true,
      ),
    [normalizedQuery, result.folders],
  );
  const filteredFiles = useMemo(() => {
    const files = result.files.filter((file) => {
      const matchesQuery = normalizedQuery
        ? [
            file.title,
            file.original_filename,
            file.description,
            file.category,
            file.file_extension,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        : true;
      const matchesType =
        typeFilter === "all" || publicFileGroup(file) === typeFilter;
      return matchesQuery && matchesType;
    });
    return files.sort((left, right) => comparePublicFiles(left, right, sort));
  }, [normalizedQuery, result.files, sort, typeFilter]);

  const selectedFiles = useMemo(
    () => result.files.filter((file) => selected.has(file.id)),
    [result.files, selected],
  );
  const selectedBytes = selectedFiles.reduce(
    (sum, file) => sum + file.file_size,
    0,
  );
  const allVisibleSelected =
    filteredFiles.length > 0 &&
    filteredFiles.every((file) => selected.has(file.id));
  const folderArchiveAllowed =
    result.currentTotalFiles <= archiveLimits.maxFiles &&
    result.currentTotalBytes <= archiveLimits.maxBytes;
  const selectedArchiveAllowed =
    selectedFiles.length <= archiveLimits.maxFiles &&
    selectedBytes <= archiveLimits.maxBytes;
  const remainingDownloads =
    result.share.max_downloads === null
      ? null
      : Math.max(0, result.share.max_downloads - result.share.download_count);

  function toggleFile(fileId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const file of filteredFiles) next.delete(file.id);
      } else {
        for (const file of filteredFiles) next.add(file.id);
      }
      return next;
    });
  }

  async function copyPageLink() {
    await copyText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyFileLink(file: PublicShareFile) {
    const full = asImportantFile(file);
    const action = canPreviewFile(full) ? "preview" : "download";
    const path = `/api/public-shares/${encodeURIComponent(token)}/files/${file.id}/${action}`;
    await copyText(`${origin}${path}`);
    setCopiedFileId(file.id);
    window.setTimeout(() => setCopiedFileId(null), 1600);
  }

  async function downloadQrCode() {
    if (!qrUrl) return;
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error("QR download failed.");
      const blob = await response.blob();
      downloadBlob(blob, `${safeFilename(result.targetName)}-share-qr.png`);
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function downloadArchive(plan: Exclude<DownloadPlan, null>) {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const endpoint = `/api/public-shares/${encodeURIComponent(token)}/archive`;
      const response =
        plan.kind === "selected"
          ? await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                path: result.currentFolder,
                fileIds: selectedFiles.map((file) => file.id),
              }),
            })
          : await fetch(
              `${endpoint}?path=${encodeURIComponent(result.currentFolder)}`,
            );
      if (!response.ok) {
        let message = "Could not create the ZIP download.";
        try {
          const payload = (await response.json()) as { error?: string };
          message = payload.error ?? message;
        } catch {
          // Keep the generic message when the response is not JSON.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = decodeFilename(disposition) || "shared-files.zip";
      downloadBlob(blob, filename);
      if (plan.kind === "selected") setSelected(new Set());
      setDownloadPlan(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not download the ZIP archive.",
      );
      setDownloadPlan(null);
    } finally {
      setDownloading(false);
    }
  }

  function markSingleDownload(fileId: number) {
    setDownloadingFileId(fileId);
    window.setTimeout(() => setDownloadingFileId(null), 1800);
  }

  const hasFilters = Boolean(normalizedQuery) || typeFilter !== "all";

  return (
    <div className="public-share-ui tech-shell min-h-screen text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050a13]/82 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1580px] items-center gap-3 px-4 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#23d8ff,#4d72ff)] text-[#04111f] shadow-[0_10px_26px_rgba(35,216,255,.18)]">
            <LockKeyhole className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-semibold sm:text-base">
              Damon&apos;s Archive
            </strong>
            <span className="block text-xs text-slate-400">
              Secure public share
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="hidden min-h-10 items-center gap-2 rounded-full border border-cyan-300/15 bg-[#0b1627]/90 px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-[#102039] md:inline-flex"
          >
            <CircleHelp className="size-4" /> Report issue
          </button>
          <button
            type="button"
            onClick={() => void copyPageLink()}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/15 bg-[#0b1627]/90 px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-[#102039]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="grid size-10 place-items-center rounded-full border border-cyan-300/15 bg-[#0b1627]/90 text-slate-100 transition hover:border-cyan-300/30 hover:bg-[#102039]"
            aria-label="Show QR code"
          >
            <QrCode className="size-5" />
          </button>
        </div>
      </header>

      <main
        className={`mx-auto max-w-[1580px] space-y-5 px-4 py-6 sm:px-6 sm:py-8 ${isFolder && allowDownloads ? "pb-32 sm:pb-8" : ""}`}
      >
        <section className="tech-panel overflow-hidden rounded-[28px] p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <TrustBadge icon={<ShieldCheck className="size-4" />} label="Verified link" tone="green" />
                <TrustBadge icon={<LockKeyhole className="size-4" />} label="Token protected" />
                <TrustBadge icon={<ShieldCheck className="size-4" />} label={publicUrl.startsWith("https://") ? "Secure connection" : "Local connection"} />
              </div>
              <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-.03em] sm:text-4xl">
                {result.targetName}
              </h1>
              {result.share.display_name ? (
                <p className="mt-2 text-sm font-medium text-slate-400">
                  Shared by {result.share.display_name}
                </p>
              ) : null}
              {result.share.share_message ? (
                <p className="mt-4 max-w-3xl whitespace-pre-wrap rounded-2xl border border-white/10 bg-[#0d192b]/75 p-4 text-sm leading-6 text-slate-300">
                  {result.share.share_message}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                <MetaItem icon={<CalendarDays className="size-4" />} label={`Last updated ${formatDate(result.lastUpdatedAt)}`} />
                <MetaItem icon={<Clock3 className="size-4" />} label={`Expires ${result.share.expires_at ? formatDateTime(result.share.expires_at) : "never"}`} />
                <MetaItem icon={<Eye className="size-4" />} label={`${result.share.view_count.toLocaleString()} view${result.share.view_count === 1 ? "" : "s"}`} />
                <MetaItem icon={<Download className="size-4" />} label={remainingDownloads === null ? `${result.share.download_count.toLocaleString()} downloads` : `${remainingDownloads.toLocaleString()} downloads remaining`} />
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:max-w-3xl">
              <Stat label="Files" value={result.totalFiles.toLocaleString()} />
              <Stat label="Size" value={formatBytes(result.totalBytes)} />
              <Stat label="Access" value={allowDownloads ? "Downloads allowed" : "Preview only"} />
              <Stat label="Preview" value="Supported files" />
            </div>
          </div>
        </section>

        {isFolder ? (
          <nav
            className="tech-panel-soft flex items-center gap-1 overflow-x-auto rounded-[18px] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Shared folder breadcrumb"
          >
            <span className="inline-flex shrink-0 items-center gap-2 px-2 text-sm font-semibold text-slate-300">
              <Folder className="size-4 text-[#1967d2]" /> Shared folder
            </span>
            {result.breadcrumbs.map((crumb, index) => (
              <span key={crumb.path} className="flex items-center gap-1">
                <ChevronRight className="size-4 shrink-0 text-slate-500" />
                <Link
                  href={sharePath(token, crumb.path)}
                  aria-current={index === result.breadcrumbs.length - 1 ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${
                    index === result.breadcrumbs.length - 1
                      ? "bg-cyan-400/10 text-cyan-200"
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {crumb.label}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-[#f6c7c3] bg-[#fce8e6] p-4 text-sm text-[#a50e0e]">
            {error}
          </div>
        ) : null}

        {isFolder && allowDownloads ? (
          <section className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-3 tech-panel rounded-[20px] border border-cyan-300/20 p-4 shadow-2xl backdrop-blur-xl sm:sticky sm:inset-x-auto sm:top-20 sm:z-30 sm:flex-row sm:items-center sm:justify-between sm:shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200">
                <FileCheck2 className="size-5" />
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-sm text-cyan-100">
                  {selected.size
                    ? `${selected.size} selected · ${formatBytes(selectedBytes)}`
                    : "Select files to download together"}
                </strong>
                <small className={`mt-1 block text-xs ${selected.size && !selectedArchiveAllowed ? "font-semibold text-red-300" : "text-slate-400"}`}>
                  {selected.size && !selectedArchiveAllowed
                    ? `Selection exceeds the ${archiveLimits.maxFiles}-file / ${formatBytes(archiveLimits.maxBytes)} ZIP limit.`
                    : !folderArchiveAllowed
                      ? `This folder is too large for one ZIP. Select up to ${archiveLimits.maxFiles} files and ${formatBytes(archiveLimits.maxBytes)}.`
                      : `ZIP limit: ${archiveLimits.maxFiles} files and ${formatBytes(archiveLimits.maxBytes)}.`}
                </small>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {selected.size ? (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="min-h-10 rounded-full border border-cyan-300/20 bg-[#0d192b] px-4 text-sm font-semibold text-cyan-200 hover:bg-[#13243b]"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                disabled={!selected.size || downloading || !selectedArchiveAllowed}
                onClick={() =>
                  setDownloadPlan({
                    kind: "selected",
                    count: selectedFiles.length,
                    bytes: selectedBytes,
                  })
                }
                title={!selectedArchiveAllowed ? "The selection exceeds the ZIP limit." : undefined}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white transition hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowDownToLine className="size-4" />
                <span>{downloading ? "Preparing…" : "Download selected"}</span>
              </button>
              <button
                type="button"
                disabled={downloading || !folderArchiveAllowed}
                onClick={() =>
                  setDownloadPlan({
                    kind: "folder",
                    count: result.currentTotalFiles,
                    bytes: result.currentTotalBytes,
                  })
                }
                title={!folderArchiveAllowed ? "This folder exceeds the ZIP limit. Open a smaller folder or select fewer files." : undefined}
                className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-cyan-300/20 bg-[#0d192b] px-4 text-sm font-semibold text-cyan-200 hover:bg-[#13243b] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
              >
                <Download className="size-4" /> Download folder
              </button>
            </div>
          </section>
        ) : null}

        {result.folders.length ? (
          <section className="space-y-3">
            <SectionTitle title="Folders" count={filteredFolders.length} />
            {filteredFolders.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredFolders.map((folder, index) => (
                  <motion.article
                    key={folder.path}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 12) * 0.035 }}
                    className="rounded-[22px] border border-white/10 bg-[#0b1627]/88 shadow-[0_14px_34px_rgba(0,5,15,.26)] transition hover:border-cyan-300/25 hover:bg-[#0e1b30]"
                  >
                    <Link
                      href={sharePath(token, folder.path)}
                      className="group flex min-h-28 items-center gap-4 p-4"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200 transition group-hover:scale-105">
                        <Folder className="size-6 fill-current" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-semibold" title={folder.name}>
                          {folder.name}
                        </strong>
                        <small className="mt-1 block text-xs text-slate-400">
                          {folder.fileCount.toLocaleString()} file{folder.fileCount === 1 ? "" : "s"} · {formatBytes(folder.totalBytes)}
                        </small>
                      </span>
                      <ChevronRight className="size-5 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-[#1967d2]" />
                    </Link>
                  </motion.article>
                ))}
              </div>
            ) : (
              <EmptySearch kind="folder" />
            )}
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionTitle
                title={isFolder ? "Files in this location" : "Shared file"}
                count={filteredFiles.length}
              />
              <p className="mt-1 text-xs text-slate-400">
                Showing {filteredFiles.length.toLocaleString()} of {result.files.length.toLocaleString()} files
              </p>
            </div>
            {isFolder && allowDownloads && result.files.length ? (
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-[#071321] px-4 text-sm font-semibold text-slate-100 hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="size-4 accent-[#1a73e8]"
                />
                Select all visible
              </label>
            ) : null}
          </div>

          {result.files.length || result.folders.length ? (
            <div className="tech-panel-soft rounded-[22px] p-3 sm:p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_190px_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search files and folders"
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-[#071321] pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-[#09192b] focus:ring-4 focus:ring-cyan-400/10"
                  />
                </label>
                <label className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as FileFilter)}
                    className="min-h-11 w-full appearance-none rounded-xl border border-white/10 bg-[#071321] pl-10 pr-8 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-400/10"
                  >
                    <option value="all">All file types</option>
                    <option value="documents">Documents</option>
                    <option value="archives">Archives</option>
                    <option value="images">Images</option>
                    <option value="videos">Videos</option>
                    <option value="audio">Audio</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as FileSort)}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-[#071321] px-3 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-400/10"
                  aria-label="Sort files"
                >
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="size-desc">Largest first</option>
                  <option value="size-asc">Smallest first</option>
                </select>
                <div className="flex items-center gap-2">
                  {hasFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setTypeFilter("all");
                      }}
                      className="min-h-11 flex-1 rounded-xl border border-[#dadce0] px-3 text-sm font-semibold text-slate-300 hover:bg-white/10 lg:flex-none"
                    >
                      Clear filters
                    </button>
                  ) : null}
                  <div className="ml-auto inline-flex rounded-xl border border-white/10 bg-[#071321] p-1">
                    <button
                      type="button"
                      onClick={() => setView("grid")}
                      className={`grid size-9 place-items-center rounded-lg transition ${view === "grid" ? "bg-cyan-400/15 text-cyan-200 shadow-sm" : "text-slate-400 hover:bg-white/10"}`}
                      aria-label="Grid view"
                    >
                      <Grid2X2 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className={`grid size-9 place-items-center rounded-lg transition ${view === "list" ? "bg-cyan-400/15 text-cyan-200 shadow-sm" : "text-slate-400 hover:bg-white/10"}`}
                      aria-label="List view"
                    >
                      <List className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {filteredFiles.length ? (
            <div
              className={
                view === "grid"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "space-y-3"
              }
            >
              {filteredFiles.map((file, index) => (
                <SharedFileCard
                  key={file.id}
                  token={token}
                  file={file}
                  view={view}
                  index={index}
                  selected={selected.has(file.id)}
                  selectionEnabled={isFolder && allowDownloads}
                  allowDownloads={allowDownloads}
                  downloading={downloadingFileId === file.id}
                  copied={copiedFileId === file.id}
                  onToggle={() => toggleFile(file.id)}
                  onPreview={() => setPreviewFile(file)}
                  onInfo={() => setInfoFile(file)}
                  onCopy={() => void copyFileLink(file)}
                  onDownload={() => markSingleDownload(file.id)}
                />
              ))}
            </div>
          ) : result.files.length ? (
            <EmptySearch kind="file" />
          ) : (
            <div className="grid min-h-60 place-items-center rounded-[24px] border border-dashed border-cyan-300/20 bg-[#0b1627]/70 p-8 text-center">
              <div>
                <Folder className="mx-auto size-10 text-[#1967d2]" />
                <h3 className="mt-4 font-semibold">This folder is empty</h3>
                <p className="mt-2 text-sm text-slate-400">
                  There are no shared files in this location.
                </p>
              </div>
            </div>
          )}
        </section>

        <footer className="flex flex-col items-center justify-center gap-3 py-5 text-center text-xs text-slate-500 sm:flex-row">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4" /> Files are served through temporary private Storage URLs.
          </span>
          <span className="hidden sm:inline">•</span>
          <button type="button" onClick={() => setShowReport(true)} className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline">
            Report a problem with this share
          </button>
        </footer>
      </main>

      <PublicPreview
        token={token}
        file={previewFile}
        allowDownloads={allowDownloads}
        onClose={() => setPreviewFile(null)}
      />
      <FileInfoModal file={infoFile} onClose={() => setInfoFile(null)} />
      <QrModal
        open={showQr}
        qrUrl={qrUrl}
        publicUrl={publicUrl}
        host={host}
        copied={copied}
        onCopy={() => void copyPageLink()}
        onDownload={() => void downloadQrCode()}
        onClose={() => setShowQr(false)}
      />
      <DownloadConfirmation
        plan={downloadPlan}
        limits={archiveLimits}
        downloading={downloading}
        onConfirm={() => downloadPlan && void downloadArchive(downloadPlan)}
        onClose={() => !downloading && setDownloadPlan(null)}
      />
      <ReportModal
        open={showReport}
        supportEmail={supportEmail}
        publicUrl={publicUrl}
        shareName={result.targetName}
        onClose={() => setShowReport(false)}
      />
    </div>
  );
}

function SharedFileCard({
  token,
  file,
  view,
  index,
  selected,
  selectionEnabled,
  allowDownloads,
  downloading,
  copied,
  onToggle,
  onPreview,
  onInfo,
  onCopy,
  onDownload,
}: {
  token: string;
  file: PublicShareFile;
  view: ViewMode;
  index: number;
  selected: boolean;
  selectionEnabled: boolean;
  allowDownloads: boolean;
  downloading: boolean;
  copied: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onInfo: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const full = asImportantFile(file);
  const previewable = canPreviewFile(full);
  const downloadUrl = `/api/public-shares/${encodeURIComponent(token)}/files/${file.id}/download`;

  if (view === "list") {
    return (
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 18) * 0.02 }}
        className={`relative flex flex-col gap-3 rounded-[20px] border bg-[#0b1627]/88 p-3 shadow-[0_14px_34px_rgba(0,5,15,.28)] transition hover:border-cyan-300/25 hover:bg-[#0e1b30] sm:flex-row sm:items-center ${selected ? "border-cyan-300/35 ring-4 ring-cyan-400/10" : "border-white/10"}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {selectionEnabled ? (
            <label className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-[#071321]">
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                className="size-4 accent-[#1a73e8]"
                aria-label={`Select ${file.title}`}
              />
            </label>
          ) : null}
          <FileTypeIcon file={full} className="size-12 shrink-0 rounded-2xl" iconClassName="size-6" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold" title={file.title}>{file.title}</h3>
            <p className="mt-1 truncate text-xs text-slate-400">
              {formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}
              {file.category ? ` · ${file.category}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {previewable ? (
            <button type="button" onClick={onPreview} className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 sm:flex-none">
              <Eye className="size-3.5" /> Preview
            </button>
          ) : (
            <span className="inline-flex min-h-9 items-center rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-400">
              Preview unavailable
            </span>
          )}
          {allowDownloads ? (
            <a href={downloadUrl} onClick={onDownload} className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-3 text-xs font-semibold text-white hover:bg-[#1557b0] sm:flex-none">
              <Download className="size-3.5" /> {downloading ? "Starting…" : "Download"}
            </a>
          ) : null}
          <FileMenu previewable={previewable} allowDownloads={allowDownloads} downloadUrl={downloadUrl} copied={copied} onPreview={onPreview} onInfo={onInfo} onCopy={onCopy} onDownload={onDownload} />
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 18) * 0.03 }}
      className={`relative flex min-h-[330px] flex-col overflow-hidden rounded-[22px] border bg-[#0b1627]/92 shadow-[0_16px_38px_rgba(0,5,15,.34)] transition hover:border-cyan-300/25 hover:bg-[#0e1b30] ${selected ? "border-cyan-300/35 ring-4 ring-cyan-400/10" : "border-white/10"}`}
    >
      {selectionEnabled ? (
        <label className="absolute left-3 top-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full border border-white/10 bg-[#071321] shadow-md">
          <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 accent-[#1a73e8]" aria-label={`Select ${file.title}`} />
        </label>
      ) : null}
      <div className="absolute right-3 top-3 z-20">
        <FileMenu previewable={previewable} allowDownloads={allowDownloads} downloadUrl={downloadUrl} copied={copied} onPreview={onPreview} onInfo={onInfo} onCopy={onCopy} onDownload={onDownload} />
      </div>
      <button type="button" disabled={!previewable} onClick={onPreview} className="flex min-h-36 w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_20%,rgba(39,211,255,.13),transparent_38%),linear-gradient(145deg,#0d1b30,#081322)] p-5 disabled:cursor-default">
        <FileTypeIcon file={full} className="size-16 rounded-[20px] shadow-sm" iconClassName="size-8" />
        <span className="mt-3 rounded-full border border-white/10 bg-[#071321] px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-slate-400 shadow-sm">
          {(file.file_extension || "FILE").toUpperCase()}
        </span>
      </button>
      <div className="flex flex-1 flex-col border-t border-white/10 p-4">
        <h3 className="truncate text-sm font-semibold" title={file.title}>{file.title}</h3>
        <p className="mt-1 truncate text-xs text-slate-400">
          {formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}
        </p>
        {file.category ? <span className="mt-2 w-fit max-w-full truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300">{file.category}</span> : null}
        {!previewable ? <p className="mt-3 text-xs text-slate-500">Preview is not available for this file type.</p> : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {previewable ? (
            <button type="button" onClick={onPreview} className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10">
              <Eye className="size-3.5" /> Preview
            </button>
          ) : null}
          {allowDownloads ? (
            <a href={downloadUrl} onClick={onDownload} className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-3 text-xs font-semibold text-white hover:bg-[#1557b0]">
              <Download className="size-3.5" /> {downloading ? "Starting…" : "Download"}
            </a>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function FileMenu({
  previewable,
  allowDownloads,
  downloadUrl,
  copied,
  onPreview,
  onInfo,
  onCopy,
  onDownload,
}: {
  previewable: boolean;
  allowDownloads: boolean;
  downloadUrl: string;
  copied: boolean;
  onPreview: () => void;
  onInfo: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <details className="group relative">
      <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-white/10 bg-[#071321] text-[#5f6368] shadow-sm transition hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="File actions">
        <MoreVertical className="size-4" />
      </summary>
      <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#091526] p-1.5 shadow-xl">
        {previewable ? <MenuButton icon={<Eye className="size-4" />} label="Preview" onClick={onPreview} /> : <div className="px-3 py-2 text-xs text-slate-500">Preview unavailable</div>}
        {allowDownloads ? <a href={downloadUrl} onClick={onDownload} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-200 hover:bg-white/8"><Download className="size-4" /> Download</a> : null}
        <MenuButton icon={copied ? <Check className="size-4" /> : <Link2 className="size-4" />} label={copied ? "Link copied" : "Copy direct link"} onClick={onCopy} />
        <MenuButton icon={<Info className="size-4" />} label="File information" onClick={onInfo} />
      </div>
    </details>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-200 hover:bg-white/8">{icon}{label}</button>;
}

function PublicPreview({ token, file, allowDownloads, onClose }: { token: string; file: PublicShareFile | null; allowDownloads: boolean; onClose: () => void }) {
  const full = file ? asImportantFile(file) : null;
  const type = full ? getFileType(full) : "other";
  const previewUrl = file ? `/api/public-shares/${encodeURIComponent(token)}/files/${file.id}/preview` : "";
  return (
    <AnimatePresence>
      {file && full ? (
        <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-[#020711]/78 p-3 backdrop-blur-sm sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
          <motion.section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-cyan-300/15 bg-[#081321] shadow-2xl" initial={{ opacity: 0, y: 24, scale: 0.975 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5"><FileTypeIcon file={full} className="size-10 rounded-xl" iconClassName="size-5" /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold sm:text-base">{file.title}</h2><p className="truncate text-xs text-slate-400">{file.original_filename} · {formatBytes(file.file_size)}</p></div>{allowDownloads ? <a href={`/api/public-shares/${encodeURIComponent(token)}/files/${file.id}/download`} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/5" aria-label="Download file"><Download className="size-5" /></a> : null}<button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/5" aria-label="Close preview"><X className="size-5" /></button></header>
            <div className="min-h-0 flex-1 bg-[#050d18] p-2 sm:p-4">{renderPreview(type, previewUrl, file)}</div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FileInfoModal({ file, onClose }: { file: PublicShareFile | null; onClose: () => void }) {
  const full = file ? asImportantFile(file) : null;
  return (
    <AnimatePresence>
      {file && full ? (
        <ModalShell onClose={onClose} maxWidth="max-w-lg">
          <header className="flex items-center gap-3 border-b border-white/10 p-5">
            <FileTypeIcon file={full} className="size-12 rounded-2xl" iconClassName="size-6" />
            <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">File information</h2><p className="truncate text-xs text-slate-400">{file.title}</p></div>
            <CloseButton onClick={onClose} />
          </header>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <InfoRow label="Original filename" value={file.original_filename} wide />
            <InfoRow label="Type" value={(file.file_extension || getFileType(full)).toUpperCase()} />
            <InfoRow label="Size" value={formatBytes(file.file_size)} />
            <InfoRow label="Uploaded" value={formatDateTime(file.created_at)} />
            <InfoRow label="Updated" value={formatDateTime(file.updated_at ?? file.created_at)} />
            <InfoRow label="Category" value={file.category || "Uncategorized"} />
            <InfoRow label="Preview" value={canPreviewFile(full) ? "Available" : "Not available"} />
            {file.description ? <InfoRow label="Description" value={file.description} wide /> : null}
          </div>
        </ModalShell>
      ) : null}
    </AnimatePresence>
  );
}

function QrModal({ open, qrUrl, publicUrl, host, copied, onCopy, onDownload, onClose }: { open: boolean; qrUrl: string; publicUrl: string; host: string; copied: boolean; onCopy: () => void; onDownload: () => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <ModalShell onClose={onClose} maxWidth="max-w-md">
          <header className="flex items-center gap-3 border-b border-white/10 p-5"><span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200"><QrCode className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-semibold">Share QR code</h2><p className="truncate text-xs text-slate-400">{host}</p></div><CloseButton onClick={onClose} /></header>
          <div className="p-5 text-center">
            {qrUrl ? <div className="mx-auto w-fit rounded-[24px] border border-white/10 bg-white p-3 shadow-sm"><Image unoptimized src={qrUrl} width={300} height={300} alt="QR code for this shared link" className="rounded-xl" /></div> : null}
            <p className="mx-auto mt-4 max-w-sm break-all text-xs leading-5 text-slate-400">{publicUrl}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={onCopy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dadce0] font-semibold text-slate-100 hover:bg-white/10">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy link"}</button><button type="button" onClick={onDownload} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] font-semibold text-white hover:bg-[#1557b0]"><Download className="size-4" /> Download QR</button></div>
            <p className="mt-4 text-[11px] text-slate-500">QR image rendering uses api.qrserver.com.</p>
          </div>
        </ModalShell>
      ) : null}
    </AnimatePresence>
  );
}

function DownloadConfirmation({ plan, limits, downloading, onConfirm, onClose }: { plan: DownloadPlan; limits: { maxFiles: number; maxBytes: number }; downloading: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {plan ? (
        <ModalShell onClose={onClose} maxWidth="max-w-md">
          <header className="flex items-center gap-3 border-b border-white/10 p-5"><span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200"><Download className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-semibold">Prepare ZIP download?</h2><p className="text-xs text-slate-400">The archive is created securely on demand.</p></div><CloseButton onClick={onClose} disabled={downloading} /></header>
          <div className="p-5"><div className="grid grid-cols-2 gap-3"><Stat label="Files" value={plan.count.toLocaleString()} /><Stat label="Total size" value={formatBytes(plan.bytes)} /></div><p className="mt-4 text-sm leading-6 text-[#5f6368]">This {plan.kind === "folder" ? "folder" : "selection"} will be prepared as one ZIP file. The maximum is {limits.maxFiles} files and {formatBytes(limits.maxBytes)}.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" disabled={downloading} onClick={onClose} className="min-h-11 rounded-full border border-[#dadce0] font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50">Cancel</button><button type="button" disabled={downloading} onClick={onConfirm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] font-semibold text-white hover:bg-[#1557b0] disabled:opacity-50"><ArrowDownToLine className="size-4" /> {downloading ? "Preparing…" : "Prepare download"}</button></div></div>
        </ModalShell>
      ) : null}
    </AnimatePresence>
  );
}

function ReportModal({ open, supportEmail, publicUrl, shareName, onClose }: { open: boolean; supportEmail: string | null; publicUrl: string; shareName: string; onClose: () => void }) {
  const mailto = supportEmail ? `mailto:${supportEmail}?subject=${encodeURIComponent(`Shared link issue: ${shareName}`)}&body=${encodeURIComponent(`I found a problem with this shared link:\n\n${publicUrl}\n\nIssue details:\n`)}` : null;
  return (
    <AnimatePresence>
      {open ? (
        <ModalShell onClose={onClose} maxWidth="max-w-md">
          <header className="flex items-center gap-3 border-b border-white/10 p-5"><span className="grid size-11 place-items-center rounded-2xl bg-[#fef7e0] text-[#b06000]"><CircleHelp className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-semibold">Report a share problem</h2><p className="text-xs text-slate-400">Broken file, unexpected content, or access issue</p></div><CloseButton onClick={onClose} /></header>
          <div className="p-5"><p className="text-sm leading-6 text-[#5f6368]">{supportEmail ? "Send the share URL and a short description to the support contact." : "Contact the person who sent you this link and include the share URL plus a short description of the problem."}</p><div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-[#5f6368]"><span className="block font-semibold">Share URL</span><span className="mt-1 block break-all">{publicUrl}</span></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void copyText(publicUrl)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dadce0] font-semibold text-slate-100 hover:bg-white/10"><Copy className="size-4" /> Copy URL</button>{mailto ? <a href={mailto} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] font-semibold text-white hover:bg-[#1557b0]"><Mail className="size-4" /> Email support</a> : <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-[#1a73e8] font-semibold text-white hover:bg-[#1557b0]">Done</button>}</div></div>
        </ModalShell>
      ) : null}
    </AnimatePresence>
  );
}

function ModalShell({ children, onClose, maxWidth }: { children: React.ReactNode; onClose: () => void; maxWidth: string }) {
  return <motion.div className="fixed inset-0 z-[110] grid place-items-center bg-[#020711]/78 p-3 backdrop-blur-sm sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><motion.section className={`max-h-[92vh] w-full overflow-auto rounded-[24px] border border-cyan-300/15 bg-[#081321] shadow-2xl ${maxWidth}`} initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.985 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>{children}</motion.section></motion.div>;
}

function CloseButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/5 disabled:opacity-50" aria-label="Close"><X className="size-5" /></button>;
}

function InfoRow({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/5 p-3 ${wide ? "sm:col-span-2" : ""}`}><span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span><strong className="mt-1 block break-words text-sm font-semibold text-slate-100">{value}</strong></div>;
}

function renderPreview(type: ReturnType<typeof getFileType>, url: string, file: PublicShareFile) {
  const frame = "h-[min(72vh,760px)] min-h-[420px]";
  if (type === "image") return <div className={`grid ${frame} place-items-center overflow-auto rounded-2xl bg-[#eef1f5] p-4`}><Image unoptimized src={url} alt={file.title} width={1600} height={1200} className="h-auto max-h-full max-w-full rounded-xl bg-white object-contain shadow-lg" /></div>;
  if (type === "video") return <div className={`grid ${frame} place-items-center overflow-hidden rounded-2xl bg-black p-2`}><video controls preload="metadata" className="max-h-full max-w-full rounded-xl" src={url}>Your browser cannot play this video.</video></div>;
  if (type === "audio") return <div className={`grid ${frame} place-items-center rounded-2xl bg-[#071321] p-8`}><audio controls preload="metadata" className="w-full max-w-xl" src={url}>Your browser cannot play this audio file.</audio></div>;
  if (type === "pdf" || type === "text") return <iframe title={`Preview ${file.title}`} src={url} className={`w-full ${frame} rounded-2xl border border-[#dadce0] bg-white`} />;
  return <div className={`grid ${frame} place-items-center rounded-2xl bg-[#071321] p-8 text-center`}><p className="text-sm text-slate-400">Preview is not available for this file type.</p></div>;
}

function asImportantFile(file: PublicShareFile): ImportantFile {
  return { ...file, owner_id: "public-share", status: "active", expires_at: null, is_favorite: false, download_count: 0, deleted_at: null };
}

function publicFileGroup(file: PublicShareFile): FileFilter {
  const type = getFileType(asImportantFile(file));
  if (["pdf", "text", "document", "spreadsheet", "presentation"].includes(type)) return "documents";
  if (type === "archive") return "archives";
  if (type === "image") return "images";
  if (type === "video") return "videos";
  if (type === "audio") return "audio";
  return "other";
}

function comparePublicFiles(left: PublicShareFile, right: PublicShareFile, sort: FileSort): number {
  const name = left.title.localeCompare(right.title, undefined, { numeric: true, sensitivity: "base" });
  const leftDate = new Date(left.updated_at ?? left.created_at ?? 0).getTime() || 0;
  const rightDate = new Date(right.updated_at ?? right.created_at ?? 0).getTime() || 0;
  switch (sort) {
    case "newest": return rightDate - leftDate || name;
    case "oldest": return leftDate - rightDate || name;
    case "name-desc": return -name;
    case "size-asc": return left.file_size - right.file_size || name;
    case "size-desc": return right.file_size - left.file_size || name;
    case "name-asc":
    default: return name;
  }
}

function sharePath(token: string, path: string): string {
  return `/share/${encodeURIComponent(token)}?path=${encodeURIComponent(path)}`;
}

function decodeFilename(disposition: string): string | null {
  const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf) return decodeURIComponent(utf);
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#f8f9fa] px-4 py-3"><span className="block text-xs font-medium text-slate-400">{label}</span><strong className="mt-1 block truncate text-sm font-semibold text-[#202124] sm:text-base" title={value}>{value}</strong></div>;
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <div className="flex items-center gap-3"><h2 className="text-lg font-semibold">{title}</h2><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">{count.toLocaleString()}</span></div>;
}

function TrustBadge({ icon, label, tone = "blue" }: { icon: React.ReactNode; label: string; tone?: "blue" | "green" }) {
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${tone === "green" ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "bg-cyan-400/10 text-cyan-200"}`}>{icon}{label}</span>;
}

function MetaItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1.5">{icon}{label}</span>;
}

function EmptySearch({ kind }: { kind: "file" | "folder" }) {
  return <div className="grid min-h-44 place-items-center rounded-[22px] border border-dashed border-cyan-300/20 bg-[#0b1627]/70 p-6 text-center"><div><Search className="mx-auto size-8 text-[#1967d2]" /><h3 className="mt-3 font-semibold">No matching {kind}s</h3><p className="mt-1 text-sm text-slate-400">Try a different search or file-type filter.</p></div></div>;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function safeOrigin(value: string): string {
  try { return new URL(value).origin; } catch { return ""; }
}

function safeHost(value: string): string {
  try { return new URL(value).host; } catch { return "Shared link"; }
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 100) || "shared-link";
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
