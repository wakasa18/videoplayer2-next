"use client";

import { ModalPortal } from "@/components/ui/modal-portal";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  File as FileIcon,
  FolderUp,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { formatBytes } from "@/lib/files/utils";

type UploadMode = "files" | "folder";
type QueueStatus =
  | "ready"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "complete"
  | "error"
  | "cancelled";

type QueueItem = {
  id: string;
  file: File;
  relativePath: string;
  status: QueueStatus;
  progress: number;
  error: string;
  duplicate: boolean;
};

type UploadDialogProps = {
  open: boolean;
  mode: UploadMode;
  onOpenChange: (open: boolean) => void;
  currentFolder: string;
  categories: string[];
  maxUploadBytes: number;
};

type PreparedUpload = {
  fileId: number;
  uploadToken: string;
  signedUrl: string;
  storageToken: string;
  objectPath: string;
  duplicate: boolean;
};

const MAX_BATCH_FILES = 100;

export function UploadDialog({
  open,
  mode,
  onOpenChange,
  currentFolder,
  categories,
  maxUploadBytes,
}: UploadDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const activeTokenRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const totalBytes = useMemo(
    () => queue.reduce((total, item) => total + item.file.size, 0),
    [queue],
  );
  const completedBytes = useMemo(
    () =>
      queue.reduce((total, item) => {
        if (item.status === "complete") return total + item.file.size;
        if (["uploading", "finalizing"].includes(item.status)) {
          return total + item.file.size * (item.progress / 100);
        }
        return total;
      }, 0),
    [queue],
  );
  const overallProgress = totalBytes
    ? Math.min(100, Math.round((completedBytes / totalBytes) * 100))
    : 0;
  const completeCount = queue.filter((item) => item.status === "complete").length;
  const failedCount = queue.filter((item) => item.status === "error").length;

  useEffect(() => {
    if (!open) return;

    const input = inputRef.current;
    if (input && mode === "folder") {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mode]);

  function addFiles(files: File[]) {
    setGlobalError("");
    const limited = files.slice(0, MAX_BATCH_FILES);
    const valid: QueueItem[] = [];
    const errors: string[] = [];

    for (const file of limited) {
      if (file.size < 1) {
        errors.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > maxUploadBytes) {
        errors.push(`${file.name} exceeds ${formatBytes(maxUploadBytes)}.`);
        continue;
      }

      const relativePath =
        mode === "folder" && file.webkitRelativePath
          ? file.webkitRelativePath
          : file.name;
      valid.push({
        id: crypto.randomUUID(),
        file,
        relativePath,
        status: "ready",
        progress: 0,
        error: "",
        duplicate: false,
      });
    }

    if (files.length > MAX_BATCH_FILES) {
      errors.push(`Only the first ${MAX_BATCH_FILES} files were added.`);
    }

    setQueue(valid);
    if (errors.length) setGlobalError(errors.slice(0, 4).join(" "));
  }

  async function startUpload() {
    if (!queue.length || uploading) return;

    setUploading(true);
    setGlobalError("");
    stopRequestedRef.current = false;

    for (const item of queue) {
      if (stopRequestedRef.current) break;
      if (item.status === "complete") continue;

      let prepared: PreparedUpload | null = null;
      try {
        updateItem(item.id, {
          status: "preparing",
          progress: 2,
          error: "",
          duplicate: false,
        });

        const folderPath = destinationFolder(currentFolder, item.relativePath);
        const prepareResponse = await fetch("/api/files/upload/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: item.file.name,
            fileSize: item.file.size,
            mimeType: item.file.type || "application/octet-stream",
            folderPath,
            description,
            category,
            documentDate,
          }),
        });
        const preparePayload = (await prepareResponse.json()) as
          | PreparedUpload
          | { error?: string };

        if (!prepareResponse.ok || !("uploadToken" in preparePayload)) {
          throw new Error(
            "error" in preparePayload && preparePayload.error
              ? preparePayload.error
              : "Could not prepare this upload.",
          );
        }

        prepared = preparePayload;
        activeTokenRef.current = prepared.uploadToken;
        if (stopRequestedRef.current) {
          throw new DOMException("Upload cancelled", "AbortError");
        }
        updateItem(item.id, {
          status: "uploading",
          progress: 5,
          duplicate: prepared.duplicate,
        });

        await uploadWithProgress(
          item.file,
          prepared,
          (progress) => {
            updateItem(item.id, {
              status: "uploading",
              progress: Math.max(5, Math.min(94, progress)),
            });
          },
          (xhr) => {
            activeXhrRef.current = xhr;
          },
        );
        activeXhrRef.current = null;

        if (stopRequestedRef.current) {
          throw new DOMException("Upload cancelled", "AbortError");
        }

        updateItem(item.id, { status: "finalizing", progress: 96 });
        const completeResponse = await fetch("/api/files/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadToken: prepared.uploadToken }),
        });
        const completePayload = (await completeResponse.json()) as {
          error?: string;
        };
        if (!completeResponse.ok) {
          throw new Error(completePayload.error || "Could not finalize the upload.");
        }

        activeTokenRef.current = null;
        updateItem(item.id, { status: "complete", progress: 100 });
      } catch (caught) {
        const cancelled =
          stopRequestedRef.current ||
          (caught instanceof DOMException && caught.name === "AbortError");

        if (prepared?.uploadToken) {
          await cancelPendingUpload(prepared.uploadToken);
        }
        activeTokenRef.current = null;
        updateItem(item.id, {
          status: cancelled ? "cancelled" : "error",
          progress: 0,
          error: cancelled
            ? "Upload cancelled."
            : caught instanceof Error
              ? caught.message
              : "Upload failed.",
        });

        if (cancelled) break;
      }
    }

    activeXhrRef.current = null;
    activeTokenRef.current = null;
    setUploading(false);
    router.refresh();
  }

  async function cancelUpload() {
    stopRequestedRef.current = true;
    activeXhrRef.current?.abort();
    const token = activeTokenRef.current;
    if (token) await cancelPendingUpload(token);
    activeTokenRef.current = null;
    setUploading(false);
  }

  function retryFailed() {
    setQueue((items) =>
      items.map((item) =>
        item.status === "error" || item.status === "cancelled"
          ? { ...item, status: "ready", progress: 0, error: "" }
          : item,
      ),
    );
  }

  function closeDialog() {
    if (uploading) return;
    setQueue([]);
    setCategory("");
    setDescription("");
    setDocumentDate("");
    setDragging(false);
    setGlobalError("");
    stopRequestedRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
    onOpenChange(false);
  }

  return (
    <ModalPortal>
      <AnimatePresence>
      {open ? (
        <motion.div
          className="tech-modal-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-2 sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-dialog-title"
            className="tech-modal-surface flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border"
            initial={{ opacity: 0, y: 22, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.975 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <motion.span
                  className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"
                  animate={uploading ? { y: [0, -2, 0] } : { y: 0 }}
                  transition={{ repeat: uploading ? Infinity : 0, duration: 1.5 }}
                >
                  {mode === "folder" ? (
                    <FolderUp className="size-5" aria-hidden="true" />
                  ) : (
                    <Upload className="size-5" aria-hidden="true" />
                  )}
                </motion.span>
                <div className="min-w-0">
                  <h2 id="upload-dialog-title" className="text-lg font-semibold text-slate-100">
                    {mode === "folder" ? "Upload a folder" : "Upload files"}
                  </h2>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    Destination: {currentFolder || "Important Files"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] disabled:opacity-40"
                aria-label="Close"
                disabled={uploading}
                onClick={closeDialog}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
              />

              {!queue.length ? (
                <motion.button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (event.currentTarget === event.target) setDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    addFiles(Array.from(event.dataTransfer.files));
                  }}
                  className={`group grid min-h-64 w-full place-items-center rounded-[26px] border-2 border-dashed p-8 text-center transition duration-200 ${
                    dragging
                      ? "scale-[1.01] border-cyan-300/40 bg-cyan-400/10"
                      : "border-cyan-300/20 bg-white/[0.04] hover:border-cyan-300/40 hover:bg-white/[0.04]"
                  }`}
                  animate={dragging ? { scale: 1.01 } : { scale: 1 }}
                >
                  <span>
                    <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-white/[0.045] text-cyan-300 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-md">
                      {mode === "folder" ? (
                        <FolderUp className="size-7" aria-hidden="true" />
                      ) : (
                        <Upload className="size-7" aria-hidden="true" />
                      )}
                    </span>
                    <strong className="mt-5 block text-base font-semibold text-slate-100">
                      {mode === "folder"
                        ? "Choose a folder to upload"
                        : "Choose files or drag them here"}
                    </strong>
                    <span className="mt-2 block text-sm leading-6 text-slate-400">
                      Up to {MAX_BATCH_FILES} files per batch · {formatBytes(maxUploadBytes)} per file
                    </span>
                  </span>
                </motion.button>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="grid gap-2 text-xs font-semibold text-slate-400">
                      Category
                      <input
                        list="upload-category-options"
                        maxLength={100}
                        value={category}
                        disabled={uploading}
                        onChange={(event) => setCategory(event.target.value)}
                        placeholder="Optional"
                        className="min-h-11 rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15 disabled:bg-white/[0.035]"
                      />
                      <datalist id="upload-category-options">
                        {categories.map((item) => (
                          <option key={item} value={item} />
                        ))}
                      </datalist>
                    </label>
                    <label className="grid gap-2 text-xs font-semibold text-slate-400">
                      Document date
                      <input
                        type="date"
                        value={documentDate}
                        disabled={uploading}
                        onChange={(event) => setDocumentDate(event.target.value)}
                        className="min-h-11 rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15 disabled:bg-white/[0.035]"
                      />
                    </label>
                    <label className="grid gap-2 text-xs font-semibold text-slate-400 sm:col-span-1">
                      Description
                      <input
                        maxLength={5000}
                        value={description}
                        disabled={uploading}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Applied to all files"
                        className="min-h-11 rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15 disabled:bg-white/[0.035]"
                      />
                    </label>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10">
                    <div className="flex items-center justify-between gap-3 bg-white/[0.035] px-4 py-3">
                      <div>
                        <strong className="text-sm font-semibold text-slate-100">
                          {queue.length} file{queue.length === 1 ? "" : "s"}
                        </strong>
                        <span className="ml-2 text-xs text-slate-400">
                          {formatBytes(totalBytes)}
                        </span>
                      </div>
                      {!uploading ? (
                        <button
                          type="button"
                          onClick={() => inputRef.current?.click()}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/10"
                        >
                          Replace selection
                        </button>
                      ) : null}
                    </div>

                    <div className="max-h-72 divide-y divide-white/10 overflow-y-auto">
                      <AnimatePresence initial={false}>
                        {queue.map((item) => (
                          <QueueRow key={item.id} item={item} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  {uploading || completeCount || failedCount ? (
                    <div className="mt-5 rounded-[20px] border border-cyan-300/20 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <strong className="text-slate-100">
                          {uploading
                            ? `Uploading ${completeCount + 1} of ${queue.length}`
                            : `${completeCount} completed${failedCount ? ` · ${failedCount} failed` : ""}`}
                        </strong>
                        <span className="font-semibold text-cyan-300">
                          {overallProgress}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-cyan-400/10">
                        <motion.span
                          className="block h-full rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)]"
                          animate={{ width: `${overallProgress}%` }}
                          transition={{ type: "spring", stiffness: 150, damping: 24 }}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {globalError ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                >
                  {globalError}
                </motion.p>
              ) : null}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs leading-5 text-slate-400">
                Duplicate names are kept as separate files with private unique storage paths.
              </p>
              <div className="flex shrink-0 justify-end gap-2">
                {failedCount > 0 && !uploading ? (
                  <button
                    type="button"
                    onClick={retryFailed}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Retry failed
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={uploading ? cancelUpload : closeDialog}
                  className="min-h-11 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  {uploading ? "Cancel upload" : completeCount ? "Close" : "Cancel"}
                </button>
                {!uploading && queue.some((item) => item.status !== "complete") ? (
                  <button
                    type="button"
                    onClick={startUpload}
                    disabled={!queue.length}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Upload {queue.length > 1 ? `${queue.length} files` : "file"}
                  </button>
                ) : null}
                {uploading ? (
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-400/10 px-5 text-sm font-semibold text-cyan-300">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Working
                  </span>
                ) : null}
              </div>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
      </AnimatePresence>
    </ModalPortal>
  );

  function updateItem(id: string, changes: Partial<QueueItem>) {
    setQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }
}

function QueueRow({ item }: { item: QueueItem }) {
  const status = statusCopy(item.status);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-white/[0.045] px-4 py-3"
    >
      <span
        className={`grid size-10 place-items-center rounded-xl ${
          item.status === "complete"
            ? "bg-emerald-400/10 text-emerald-300"
            : item.status === "error" || item.status === "cancelled"
              ? "bg-red-400/10 text-red-300"
              : "bg-cyan-400/10 text-cyan-300"
        }`}
      >
        {item.status === "complete" ? (
          <CheckCircle2 className="size-5" aria-hidden="true" />
        ) : item.status === "error" || item.status === "cancelled" ? (
          <AlertCircle className="size-5" aria-hidden="true" />
        ) : item.status === "ready" ? (
          <FileIcon className="size-5" aria-hidden="true" />
        ) : (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="truncate text-sm font-semibold text-slate-100">
            {item.relativePath}
          </strong>
          {item.duplicate ? (
            <span className="shrink-0 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              Copy
            </span>
          ) : null}
        </div>
        <p
          className={`mt-1 truncate text-xs ${
            item.error ? "text-red-300" : "text-slate-400"
          }`}
        >
          {item.error || `${formatBytes(item.file.size)} · ${status}`}
        </p>
        {item.status === "uploading" || item.status === "finalizing" ? (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.span
              className="block h-full rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)]"
              animate={{ width: `${item.progress}%` }}
            />
          </div>
        ) : null}
      </div>
      <span className="text-xs font-semibold text-slate-400">
        {item.status === "uploading" || item.status === "finalizing"
          ? `${item.progress}%`
          : status}
      </span>
    </motion.div>
  );
}

function statusCopy(status: QueueStatus): string {
  switch (status) {
    case "preparing":
      return "Preparing";
    case "uploading":
      return "Uploading";
    case "finalizing":
      return "Finalizing";
    case "complete":
      return "Complete";
    case "error":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Ready";
  }
}

function destinationFolder(currentFolder: string, relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  parts.pop();
  return [currentFolder, parts.join("/")].filter(Boolean).join("/");
}

async function uploadWithProgress(
  file: File,
  prepared: PreparedUpload,
  onProgress: (progress: number) => void,
  onRequest: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const apiKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", file);

    xhr.open("PUT", prepared.signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    if (apiKey) xhr.setRequestHeader("apikey", apiKey);
    const bearer = session?.access_token || apiKey;
    if (bearer) xhr.setRequestHeader("Authorization", `Bearer ${bearer}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 94));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(94);
        resolve();
        return;
      }
      reject(new Error(readUploadError(xhr)));
    });
    xhr.addEventListener("error", () =>
      reject(new Error("The browser could not reach Supabase Storage.")),
    );
    xhr.addEventListener("abort", () =>
      reject(new DOMException("Upload cancelled", "AbortError")),
    );

    onRequest(xhr);
    xhr.send(formData);
  });
}

function readUploadError(xhr: XMLHttpRequest): string {
  try {
    const payload = JSON.parse(xhr.responseText) as {
      message?: string;
      error?: string;
    };
    return payload.message || payload.error || `Storage returned HTTP ${xhr.status}.`;
  } catch {
    return xhr.responseText || `Storage returned HTTP ${xhr.status}.`;
  }
}

async function cancelPendingUpload(uploadToken: string): Promise<void> {
  try {
    await fetch("/api/files/upload/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadToken }),
    });
  } catch {
    // Failed/pending rows can be cleaned later; cancellation should stay responsive.
  }
}
