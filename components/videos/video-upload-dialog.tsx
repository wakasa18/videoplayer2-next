"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Film,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatBytes,
  isLikelyBrowserPlayableVideo,
  normalizeVideoMimeType,
} from "@/lib/videos/utils";

type Status = "ready" | "preparing" | "uploading" | "finalizing" | "complete" | "error" | "cancelled";
type QueueItem = {
  id: string;
  file: File;
  status: Status;
  progress: number;
  error: string;
  duration: number | null;
};
type Prepared = {
  videoId: number;
  uploadToken: string;
  signedUrl: string;
  storageToken: string;
  objectPath: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  maxUploadBytes: number;
};

const MAX_BATCH = 20;

export function VideoUploadDialog({ open, onOpenChange, categories, maxUploadBytes }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeXhr = useRef<XMLHttpRequest | null>(null);
  const activeToken = useRef<string | null>(null);
  const stopRequested = useRef(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [open]);

  const totalBytes = useMemo(() => queue.reduce((sum, item) => sum + item.file.size, 0), [queue]);
  const completedBytes = useMemo(
    () =>
      queue.reduce((sum, item) => {
        if (item.status === "complete") return sum + item.file.size;
        if (["uploading", "finalizing"].includes(item.status)) {
          return sum + item.file.size * (item.progress / 100);
        }
        return sum;
      }, 0),
    [queue],
  );
  const progress = totalBytes ? Math.round((completedBytes / totalBytes) * 100) : 0;
  const completeCount = queue.filter((item) => item.status === "complete").length;
  const failedCount = queue.filter((item) => item.status === "error").length;
  const limitedPlaybackCount = useMemo(
    () =>
      queue.filter(
        (item) => !isLikelyBrowserPlayableVideo(item.file.type, item.file.name),
      ).length,
    [queue],
  );

  async function chooseFiles(files: File[]) {
    setGlobalError("");
    const errors: string[] = [];
    const accepted: QueueItem[] = [];
    for (const file of files.slice(0, MAX_BATCH)) {
      const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i.test(file.name);
      if (!isVideo) {
        errors.push(`${file.name} is not a supported video.`);
        continue;
      }
      if (!file.size) {
        errors.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > maxUploadBytes) {
        errors.push(`${file.name} exceeds ${formatBytes(maxUploadBytes)}.`);
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        status: "ready",
        progress: 0,
        error: "",
        duration: null,
      });
    }
    if (files.length > MAX_BATCH) errors.push(`Only the first ${MAX_BATCH} videos were added.`);
    setQueue(accepted);
    if (errors.length) setGlobalError(errors.slice(0, 4).join(" "));

    const durations = await Promise.all(accepted.map((item) => readDuration(item.file)));
    setQueue((current) =>
      current.map((item) => {
        const index = accepted.findIndex((candidate) => candidate.id === item.id);
        return index >= 0 ? { ...item, duration: durations[index] } : item;
      }),
    );
  }

  async function startUpload() {
    if (!queue.length || uploading) return;
    setUploading(true);
    setGlobalError("");
    stopRequested.current = false;

    for (const item of queue) {
      if (stopRequested.current) break;
      if (item.status === "complete") continue;
      let prepared: Prepared | null = null;
      try {
        update(item.id, { status: "preparing", progress: 2, error: "" });
        const response = await fetch("/api/videos/upload/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: item.file.name,
            fileSize: item.file.size,
            mimeType: normalizeVideoMimeType(item.file.type, item.file.name),
            description,
            category,
            durationSeconds: item.duration,
          }),
        });
        const payload = (await response.json()) as Prepared | { error?: string };
        if (!response.ok || !("uploadToken" in payload)) {
          throw new Error("error" in payload && payload.error ? payload.error : "Could not prepare upload.");
        }
        prepared = payload;
        activeToken.current = prepared.uploadToken;
        update(item.id, { status: "uploading", progress: 5 });
        await uploadWithProgress(
          item.file,
          prepared,
          (value) => update(item.id, { status: "uploading", progress: Math.max(5, Math.min(94, value)) }),
          (xhr) => {
            activeXhr.current = xhr;
          },
        );
        activeXhr.current = null;
        if (stopRequested.current) throw new DOMException("Upload cancelled", "AbortError");
        update(item.id, { status: "finalizing", progress: 96 });
        const complete = await fetch("/api/videos/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadToken: prepared.uploadToken }),
        });
        const completePayload = (await complete.json()) as { error?: string };
        if (!complete.ok) throw new Error(completePayload.error || "Could not finalize upload.");
        activeToken.current = null;
        update(item.id, { status: "complete", progress: 100 });
      } catch (error) {
        const cancelled =
          stopRequested.current || (error instanceof DOMException && error.name === "AbortError");
        if (prepared?.uploadToken) await cancelPending(prepared.uploadToken);
        activeToken.current = null;
        update(item.id, {
          status: cancelled ? "cancelled" : "error",
          progress: 0,
          error: cancelled ? "Upload cancelled." : error instanceof Error ? error.message : "Upload failed.",
        });
        if (cancelled) break;
      }
    }

    activeXhr.current = null;
    activeToken.current = null;
    setUploading(false);
    router.refresh();
  }

  async function cancel() {
    stopRequested.current = true;
    activeXhr.current?.abort();
    if (activeToken.current) await cancelPending(activeToken.current);
    activeToken.current = null;
    setUploading(false);
  }

  function retry() {
    setQueue((items) =>
      items.map((item) =>
        item.status === "error" || item.status === "cancelled"
          ? { ...item, status: "ready", progress: 0, error: "" }
          : item,
      ),
    );
  }

  function close() {
    if (uploading) return;
    setQueue([]);
    setCategory("");
    setDescription("");
    setGlobalError("");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
    onOpenChange(false);
  }

  function update(id: string, patch: Partial<QueueItem>) {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[110] grid place-items-center bg-[#020611]/75 p-3 backdrop-blur-[3px] sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-upload-title"
            className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1220]/95 shadow-[0_24px_70px_rgba(0,4,14,0.6)] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 22, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.975 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <motion.span
                  className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"
                  animate={uploading ? { y: [0, -2, 0] } : undefined}
                  transition={{ repeat: uploading ? Infinity : 0, duration: 1.4 }}
                >
                  <Upload className="size-5" />
                </motion.span>
                <div>
                  <h2 id="video-upload-title" className="text-lg font-semibold text-slate-100">Upload videos</h2>
                  <p className="mt-1 text-xs text-slate-400">Private storage · up to {formatBytes(maxUploadBytes)} each</p>
                </div>
              </div>
              <button type="button" onClick={close} disabled={uploading} className="grid size-10 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] disabled:opacity-40" aria-label="Close upload dialog">
                <X className="size-5" />
              </button>
            </header>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-200">
                  Category
                  <input list="video-categories" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Optional" disabled={uploading} className="mt-2 h-11 w-full rounded-2xl border border-white/10 px-4 outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15" />
                  <datalist id="video-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
                </label>
                <label className="text-sm font-medium text-slate-200">
                  Description
                  <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Applied to all videos" disabled={uploading} className="mt-2 h-11 w-full rounded-2xl border border-white/10 px-4 outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15" />
                </label>
              </div>

              {queue.length === 0 ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFiles(Array.from(event.dataTransfer.files)); }}
                  className={`mt-5 grid min-h-64 w-full place-items-center rounded-[24px] border-2 border-dashed p-8 text-center transition ${dragging ? "border-cyan-300/40 bg-cyan-400/10" : "border-cyan-300/20 bg-white/[0.04] hover:bg-white/[0.04]"}`}
                >
                  <span>
                    <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Film className="size-8" /></span>
                    <strong className="mt-5 block text-base text-slate-100">Choose videos or drag them here</strong>
                    <span className="mt-2 block text-sm text-slate-400">MP4, WebM, MOV, M4V, OGV, AVI, or MKV</span>
                  </span>
                </button>
              ) : (
                <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
                  <div className="flex items-center justify-between bg-white/[0.035] px-4 py-3 text-xs text-slate-400">
                    <span><strong className="text-slate-100">{queue.length} video{queue.length === 1 ? "" : "s"}</strong> · {formatBytes(totalBytes)}</span>
                    {!uploading ? <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-cyan-300">Replace selection</button> : null}
                  </div>
                  <div className="max-h-72 divide-y divide-white/10 overflow-y-auto">
                    {queue.map((item) => <QueueRow key={item.id} item={item} />)}
                  </div>
                </div>
              )}
              <input ref={inputRef} type="file" accept="video/*,.mkv,.avi" multiple hidden onChange={(event) => void chooseFiles(Array.from(event.target.files ?? []))} />

              {queue.length ? (
                <div className="mt-5 rounded-[20px] border border-cyan-300/20 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between text-sm"><strong className="text-slate-200">{completeCount} completed · {failedCount} failed</strong><span className="font-semibold text-cyan-300">{progress}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-cyan-400/10"><motion.span className="block h-full rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)]" animate={{ width: `${progress}%` }} /></div>
                </div>
              ) : null}

              {limitedPlaybackCount ? (
                <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-300">
                  <AlertCircle className="mt-0.5 size-5 shrink-0" />
                  <p>
                    {limitedPlaybackCount} selected video{limitedPlaybackCount === 1 ? " uses" : "s use"} a format such as MKV or AVI. It can be stored and downloaded, but browser playback depends on the codecs and browser. MP4 with H.264/AAC or WebM is recommended for reliable playback.
                  </p>
                </div>
              ) : null}
              {globalError ? <div className="mt-4 flex gap-3 rounded-2xl border border-red-300/25 bg-red-400/10 p-4 text-sm text-red-300"><AlertCircle className="size-5 shrink-0" /><p>{globalError}</p></div> : null}
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
              {failedCount && !uploading ? <button type="button" onClick={retry} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-5 font-semibold text-slate-200 hover:bg-white/[0.06]"><RotateCcw className="size-4" />Retry failed</button> : null}
              <button type="button" onClick={uploading ? cancel : close} className="h-11 rounded-full border border-white/10 px-5 font-semibold text-slate-200 hover:bg-white/[0.06]">{uploading ? "Cancel upload" : "Cancel"}</button>
              <button type="button" onClick={() => void startUpload()} disabled={!queue.length || uploading || completeCount === queue.length} className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{uploading ? "Uploading" : queue.length > 1 ? "Upload videos" : "Upload video"}</button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const Icon = item.status === "complete" ? CheckCircle2 : item.status === "error" ? AlertCircle : item.status === "preparing" || item.status === "uploading" || item.status === "finalizing" ? Loader2 : Film;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.status === "complete" ? "bg-emerald-400/10 text-emerald-300" : item.status === "error" ? "bg-red-400/10 text-red-300" : "bg-cyan-400/10 text-cyan-300"}`}><Icon className={`size-5 ${["preparing", "uploading", "finalizing"].includes(item.status) ? "animate-spin" : ""}`} /></span>
      <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-100">{item.file.name}</strong><p className={`mt-1 truncate text-xs ${item.error ? "text-red-300" : "text-slate-400"}`}>{item.error || `${formatBytes(item.file.size)} · ${item.status}`}</p>{item.status === "uploading" ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><span className="block h-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)]" style={{ width: `${item.progress}%` }} /></div> : null}</div>
      <span className="text-xs font-semibold text-slate-400">{item.progress ? `${item.progress}%` : ""}</span>
    </div>
  );
}

async function uploadWithProgress(
  file: File,
  prepared: Prepared,
  onProgress: (value: number) => void,
  onRequest: (xhr: XMLHttpRequest) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const contentType = normalizeVideoMimeType(file.type, file.name);
    const uploadBody = file.type === contentType
      ? file
      : new File([file], file.name, { type: contentType, lastModified: file.lastModified });

    formData.append("cacheControl", "3600");
    formData.append("", uploadBody);
    xhr.open("PUT", prepared.signedUrl);
    xhr.setRequestHeader("x-upsert", "false");

    // A signed upload URL already contains its own authorization token.
    // Sending the user's Auth bearer token here can make Storage evaluate RLS
    // instead of the signed-upload permission and may cause inconsistent uploads.
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 94));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(94);
        resolve();
      }
      else reject(new Error(readUploadError(xhr)));
    });
    xhr.addEventListener("error", () => reject(new Error("The browser could not reach Supabase Storage.")));
    xhr.addEventListener("abort", () => reject(new DOMException("Upload cancelled", "AbortError")));
    onRequest(xhr);
    xhr.send(formData);
  });
}

function readUploadError(xhr: XMLHttpRequest): string {
  try {
    const payload = JSON.parse(xhr.responseText) as { message?: string; error?: string };
    return payload.message || payload.error || `Storage returned HTTP ${xhr.status}.`;
  } catch {
    return xhr.responseText || `Storage returned HTTP ${xhr.status}.`;
  }
}

async function cancelPending(uploadToken: string) {
  try {
    await fetch("/api/videos/upload/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadToken }),
    });
  } catch {
    // A later cleanup can remove stale pending uploads.
  }
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const element = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      element.remove();
      resolve(value);
    };
    element.preload = "metadata";
    element.onloadedmetadata = () => finish(Number.isFinite(element.duration) ? element.duration : null);
    element.onerror = () => finish(null);
    element.src = url;
  });
}
