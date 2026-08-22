"use client";

import {
  AlertCircle,
  Download,
  FileUp,
  Loader2,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { useRef, useState } from "react";

import { normalizeVideoMimeType } from "@/lib/videos/utils";

type SourceMode = "proxy" | "direct";
type ProbeResult = {
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  assessment?: string;
  message?: string;
  rangeSupported?: boolean;
  mp4FastStart?: boolean | null;
  firstRequestStatus?: number;
  tailRequestStatus?: number | null;
  error?: string;
  code?: string;
  canRepair?: boolean;
};
type RepairPrepared = {
  repairToken: string;
  signedUrl: string;
  storageToken: string;
  objectPath: string;
};

const MISSING_OBJECT_CODE = "VIDEO_OBJECT_MISSING";

export function VideoPlayer({
  id,
  title,
  filename,
  mimeType,
  initialMissing = false,
}: {
  id: number;
  title: string;
  filename: string;
  mimeType: string;
  initialMissing?: boolean;
}) {
  const secureStream = `/api/videos/${id}/stream`;
  const repairInput = useRef<HTMLInputElement>(null);
  const activeRepairRequest = useRef<XMLHttpRequest | null>(null);
  const [source, setSource] = useState(`${secureStream}?v=0`);
  const [sourceMode, setSourceMode] = useState<SourceMode>("proxy");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(!initialMissing);
  const [status, setStatus] = useState(initialMissing ? "" : "Loading secure stream…");
  const [error, setError] = useState(
    initialMissing
      ? "The video record exists, but its file is missing from Supabase Storage."
      : "",
  );
  const [probe, setProbe] = useState<ProbeResult | null>(
    initialMissing
      ? { code: MISSING_OBJECT_CODE, canRepair: true }
      : null,
  );
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const [repairError, setRepairError] = useState("");
  const handlingError = useRef(false);

  const missingObject = probe?.code === MISSING_OBJECT_CODE || probe?.canRepair === true;

  function retry() {
    const nextAttempt = attempt + 1;
    handlingError.current = false;
    setError("");
    setProbe(null);
    setRepairError("");
    setLoading(true);
    setStatus("Loading secure stream…");
    setSourceMode("proxy");
    setAttempt(nextAttempt);
    setSource(`${secureStream}?v=${nextAttempt}`);
  }

  async function handlePlaybackError(code: number | undefined) {
    setLoading(false);
    if (handlingError.current) return;
    handlingError.current = true;

    if (sourceMode === "proxy") {
      setLoading(true);
      setStatus("Secure stream failed. Checking direct storage playback…");
      try {
        const response = await fetch(`/api/videos/${id}/source`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = (await response.json().catch(() => null)) as
          | { url?: string; error?: string; code?: string; canRepair?: boolean }
          | null;
        if (!response.ok || !payload?.url) {
          if (payload?.code === MISSING_OBJECT_CODE || payload?.canRepair) {
            setProbe(payload);
            setError(
              payload.error ||
                "The video record exists, but its file is missing from Supabase Storage.",
            );
            setStatus("");
            setLoading(false);
            handlingError.current = false;
            return;
          }
          throw new Error(
            payload?.error || `Playback URL returned HTTP ${response.status}.`,
          );
        }
        setSourceMode("direct");
        setSource(payload.url);
        setAttempt((value) => value + 1);
        handlingError.current = false;
        return;
      } catch (caught) {
        setLoading(false);
        const detail =
          caught instanceof Error
            ? caught.message
            : "Direct playback could not be opened.";
        await finishWithDiagnostics(code, detail);
        return;
      }
    }

    await finishWithDiagnostics(code);
  }

  async function finishWithDiagnostics(code: number | undefined, extra = "") {
    setStatus("Checking the stored video…");
    let result: ProbeResult | null = null;
    try {
      const response = await fetch(`/api/videos/${id}/probe`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      result = (await response.json().catch(() => null)) as ProbeResult | null;
      if (!response.ok && !result?.error) {
        result = { error: `Video diagnostics returned HTTP ${response.status}.` };
      }
    } catch (caught) {
      result = {
        error: caught instanceof Error ? caught.message : "Video diagnostics failed.",
      };
    }

    setProbe(result);
    setError(buildErrorMessage(code, result, extra));
    setStatus("");
    setLoading(false);
    handlingError.current = false;
  }

  async function restoreVideo(file: File) {
    if (repairing) return;
    setRepairing(true);
    setRepairProgress(1);
    setRepairError("");
    let prepared: RepairPrepared | null = null;

    try {
      if (!file.size) throw new Error("The selected video is empty.");
      if (
        !file.type.startsWith("video/") &&
        !/\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i.test(file.name)
      ) {
        throw new Error("Choose a supported video file.");
      }

      const duration = await readDuration(file);
      const prepareResponse = await fetch(`/api/videos/${id}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          fileSize: file.size,
          mimeType: normalizeVideoMimeType(file.type, file.name),
          durationSeconds: duration,
        }),
      });
      const preparePayload = (await prepareResponse.json().catch(() => null)) as
        | RepairPrepared
        | { error?: string }
        | null;
      if (
        !prepareResponse.ok ||
        !preparePayload ||
        !("repairToken" in preparePayload)
      ) {
        throw new Error(
          (preparePayload && "error" in preparePayload && preparePayload.error) ||
            "Could not prepare the replacement upload.",
        );
      }
      prepared = preparePayload;
      setRepairProgress(5);

      await uploadReplacement(
        file,
        prepared.signedUrl,
        (value) => setRepairProgress(Math.max(5, Math.min(94, value))),
        (xhr) => {
          activeRepairRequest.current = xhr;
        },
      );
      activeRepairRequest.current = null;
      setRepairProgress(96);

      const completeResponse = await fetch(`/api/videos/${id}/repair`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repairToken: prepared.repairToken }),
      });
      const completePayload = (await completeResponse.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!completeResponse.ok || !completePayload?.success) {
        throw new Error(completePayload?.error || "Could not finalize the restored video.");
      }

      setRepairProgress(100);
      window.location.reload();
    } catch (caught) {
      activeRepairRequest.current = null;
      if (prepared?.repairToken) {
        await cancelRepair(id, prepared.repairToken);
      }
      setRepairProgress(0);
      setRepairError(
        caught instanceof Error ? caught.message : "The video could not be restored.",
      );
      setRepairing(false);
    } finally {
      if (repairInput.current) repairInput.current.value = "";
    }
  }

  if (error) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-[24px] border border-[#f6c7c3] bg-[#fce8e6] p-6 text-center sm:p-8">
        <div className="max-w-2xl">
          <AlertCircle className="mx-auto size-10 text-[#c5221f]" />
          <h2 className="mt-4 font-semibold text-[#202124]">
            {missingObject ? "Video file is missing" : "Video could not be played"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6368]">{error}</p>
          <p className="mt-2 break-all text-xs text-[#80868b]">
            {filename} · {mimeType || "unknown MIME type"}
          </p>

          {probe && !missingObject ? (
            <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 gap-2 rounded-2xl border border-[#f1b8b3] bg-white/70 p-3 text-left text-xs text-[#5f6368] sm:grid-cols-4">
              <ProbeValue label="Container" value={probe.container} />
              <ProbeValue label="Video codec" value={probe.videoCodec} />
              <ProbeValue label="Audio codec" value={probe.audioCodec} />
              <ProbeValue
                label="Byte ranges"
                value={
                  probe.rangeSupported === undefined
                    ? undefined
                    : probe.rangeSupported
                      ? "supported"
                      : "not confirmed"
                }
              />
            </div>
          ) : null}

          {missingObject ? (
            <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-[#f1b8b3] bg-white/75 p-4 text-left text-sm leading-6 text-[#5f6368]">
              The database information was migrated, but the actual video bytes are not in the
              configured Supabase Storage bucket. Select the original video from your computer to
              reconnect this record. Its title, category, favorite state, views, and other metadata
              will be kept.
            </div>
          ) : null}

          {repairError ? (
            <p className="mx-auto mt-3 max-w-xl rounded-xl bg-white/80 px-3 py-2 text-sm text-[#a50e0e]">
              {repairError}
            </p>
          ) : null}

          {repairing ? (
            <div className="mx-auto mt-4 max-w-md">
              <div className="flex items-center justify-between text-xs font-semibold text-[#5f6368]">
                <span>Restoring video file…</span>
                <span>{repairProgress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                <span
                  className="block h-full rounded-full bg-[#1a73e8] transition-[width]"
                  style={{ width: `${repairProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {missingObject ? (
              <>
                <button
                  type="button"
                  onClick={() => repairInput.current?.click()}
                  disabled={repairing}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {repairing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileUp className="size-4" />
                  )}
                  Select original video
                </button>
                <input
                  ref={repairInput}
                  type="file"
                  accept="video/*,.mkv,.avi"
                  hidden
                  disabled={repairing}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void restoreVideo(file);
                  }}
                />
              </>
            ) : (
              <button
                type="button"
                onClick={retry}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white hover:bg-[#1557b0]"
              >
                <RotateCcw className="size-4" />Retry both methods
              </button>
            )}
            {!missingObject ? (
              <a
                href={`/api/videos/${id}/download`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
              >
                <Download className="size-4" />Download
              </a>
            ) : null}
          </div>

          {!missingObject ? (
            <p className="mt-4 text-xs leading-5 text-[#80868b]">
              MP4 is only a container. For the widest browser support, use H.264/AVC video
              with AAC audio, or WebM.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-black shadow-sm">
      <video
        key={`${attempt}-${sourceMode}`}
        controls
        playsInline
        preload="metadata"
        src={source}
        aria-label={`Play ${title}`}
        onLoadStart={() => {
          setLoading(true);
          setStatus(
            sourceMode === "proxy"
              ? "Loading secure stream…"
              : "Trying direct storage playback…",
          );
        }}
        onLoadedMetadata={() => {
          setLoading(false);
          setStatus("");
        }}
        onCanPlay={() => {
          setLoading(false);
          setStatus("");
          setError("");
        }}
        onPlaying={() => {
          setLoading(false);
          setStatus("");
        }}
        onError={(event) => void handlePlaybackError(event.currentTarget.error?.code)}
        className="aspect-video w-full bg-black object-contain"
      >
        Your browser does not support HTML video playback.
      </video>
      {loading ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/30 px-4 text-center text-white">
          <span className="rounded-2xl bg-black/60 px-5 py-4 backdrop-blur">
            <Loader2 className="mx-auto size-6 animate-spin" />
            <span className="mt-2 block text-xs font-medium">
              {status || "Loading video…"}
            </span>
          </span>
        </span>
      ) : null}
      <span className="pointer-events-none absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
        <PlayCircle className="size-5" />
      </span>
    </div>
  );
}

function ProbeValue({ label, value }: { label: string; value: string | undefined }) {
  return (
    <span className="min-w-0">
      <span className="block text-[10px] uppercase tracking-wide text-[#9aa0a6]">
        {label}
      </span>
      <strong className="mt-0.5 block truncate font-semibold text-[#3c4043]">
        {value || "unknown"}
      </strong>
    </span>
  );
}

function buildErrorMessage(
  code: number | undefined,
  probe: ProbeResult | null,
  extra: string,
): string {
  if (probe?.code === MISSING_OBJECT_CODE || probe?.canRepair) {
    return (
      probe.error ||
      "The video record exists, but its file is missing from Supabase Storage."
    );
  }
  if (probe?.error) return mergeMessages(extra, probe.error);
  if (probe?.message) return mergeMessages(extra, probe.message);

  switch (code) {
    case 1:
      return mergeMessages(extra, "Playback was stopped before the video finished loading.");
    case 2:
      return mergeMessages(extra, "Both secure and direct playback requests failed.");
    case 3:
      return mergeMessages(
        extra,
        "The file loaded, but the browser could not decode its video or audio codec.",
      );
    case 4:
      return mergeMessages(
        extra,
        "The browser rejected the media source. It may be incomplete or use an unsupported codec.",
      );
    default:
      return extra || "The player received an unknown playback error.";
  }
}

function mergeMessages(first: string, second: string): string {
  const a = first.trim().replace(/[.!?]+$/, "");
  const b = second.trim();
  if (!a) return b;
  if (!b) return first.trim();
  if (a.toLowerCase() === b.replace(/[.!?]+$/, "").toLowerCase()) return b;
  if (b.toLowerCase().includes(a.toLowerCase())) return b;
  return `${a}. ${b}`;
}

async function uploadReplacement(
  file: File,
  signedUrl: string,
  onProgress: (value: number) => void,
  onRequest: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const contentType = normalizeVideoMimeType(file.type, file.name);
    const uploadBody =
      file.type === contentType
        ? file
        : new File([file], file.name, {
            type: contentType,
            lastModified: file.lastModified,
          });

    formData.append("cacheControl", "3600");
    formData.append("", uploadBody);
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 94));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(94);
        resolve();
      } else {
        reject(new Error(readUploadError(xhr)));
      }
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
    const payload = JSON.parse(xhr.responseText) as { message?: string; error?: string };
    return payload.message || payload.error || `Storage returned HTTP ${xhr.status}.`;
  } catch {
    return xhr.responseText || `Storage returned HTTP ${xhr.status}.`;
  }
}

async function cancelRepair(videoId: number, repairToken: string) {
  try {
    await fetch(`/api/videos/${videoId}/repair`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repairToken }),
    });
  } catch {
    // The signed replacement object expires and can be cleaned up later.
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
    element.onloadedmetadata = () =>
      finish(Number.isFinite(element.duration) ? element.duration : null);
    element.onerror = () => finish(null);
    element.src = url;
  });
}
