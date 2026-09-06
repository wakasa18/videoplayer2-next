"use client";

import { CloudOff, Download, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

import { FileTypeIcon } from "@/components/file-type-icon";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, getFileType } from "@/lib/files/utils";
import { getOfflineFileObjectUrl } from "@/lib/mobile/offline-files";

type FilePreviewProps = {
  file: ImportantFile;
  compact?: boolean;
};

export function FilePreview({ file, compact = false }: FilePreviewProps) {
  const type = getFileType(file);
  const onlinePreviewUrl = `/api/files/${file.id}/preview`;
  const [offline, setOffline] = useState(false);
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null);
  const frameClass = compact
    ? "h-[min(72vh,760px)] min-h-[420px]"
    : "h-[min(72vh,820px)] min-h-[520px]";

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    const sync = async () => {
      const isOffline = !navigator.onLine;
      if (active) setOffline(isOffline);
      if (!isOffline) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        if (active) setOfflineUrl(null);
        return;
      }
      const url = await getOfflineFileObjectUrl(file.id);
      objectUrl = url;
      if (active) setOfflineUrl(url);
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      active = false;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id]);

  const previewUrl = offline ? offlineUrl : onlinePreviewUrl;
  if (offline && !offlineUrl) {
    return (
      <div className={`grid ${frameClass} place-items-center rounded-2xl bg-white/[0.045] p-8 text-center`}>
        <div className="max-w-md">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><CloudOff className="size-7" /></span>
          <h3 className="mt-5 text-lg font-semibold text-slate-100">No offline copy on this device</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Reconnect once, open the file menu, and choose <strong className="text-slate-200">Available offline</strong>.</p>
        </div>
      </div>
    );
  }

  if (type === "image") {
    return (
      <div className={`grid ${frameClass} place-items-center overflow-auto rounded-2xl bg-white/[0.04] p-4`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl ?? undefined} alt={file.title} className="max-h-full max-w-full rounded-xl bg-white/[0.045] object-contain shadow-lg" />
      </div>
    );
  }

  if (type === "video") {
    return <div className={`grid ${frameClass} place-items-center overflow-hidden rounded-2xl bg-black p-2`}><video controls preload="metadata" className="max-h-full max-w-full rounded-xl" src={previewUrl ?? undefined}>Your browser cannot play this video.</video></div>;
  }

  if (type === "audio") {
    return (
      <div className={`grid ${frameClass} place-items-center rounded-2xl bg-gradient-to-br from-[#12203a] to-[#081321] p-8`}>
        <div className="w-full max-w-xl rounded-[24px] border border-cyan-300/20 bg-white/[0.045] p-8 text-center shadow-sm">
          <FileTypeIcon file={file} className="mx-auto size-20 rounded-[24px]" iconClassName="size-9" />
          <h3 className="mt-5 truncate text-lg font-semibold text-slate-100">{file.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{formatBytes(file.file_size)}</p>
          <audio controls preload="metadata" className="mt-6 w-full" src={previewUrl ?? undefined}>Your browser cannot play this audio file.</audio>
        </div>
      </div>
    );
  }

  if (type === "pdf" || type === "text") {
    return <iframe title={`Preview ${file.title}`} src={previewUrl ?? undefined} className={`w-full ${frameClass} rounded-2xl border border-white/10 bg-white/[0.045]`} />;
  }

  return (
    <div className={`grid ${frameClass} place-items-center rounded-2xl bg-white/[0.045] p-8 text-center`}>
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/[0.05] text-slate-400"><EyeOff className="size-7" /></span>
        <h3 className="mt-5 text-lg font-semibold text-slate-100">Preview is not available</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">This file type cannot be shown safely in the browser. Download it to open it with the appropriate application.</p>
        {!offline ? <a href={`/api/files/${file.id}/download`} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110"><Download className="size-4" />Download file</a> : null}
      </div>
    </div>
  );
}

export function FilePreviewStatus({ file }: { file: ImportantFile }) {
  return canPreviewFile(file) ? "Preview available" : "Download required";
}
