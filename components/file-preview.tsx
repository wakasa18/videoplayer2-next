"use client";

import { Download, EyeOff } from "lucide-react";

import { FileTypeIcon } from "@/components/file-type-icon";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, getFileType } from "@/lib/files/utils";

type FilePreviewProps = {
  file: ImportantFile;
  compact?: boolean;
};

export function FilePreview({ file, compact = false }: FilePreviewProps) {
  const type = getFileType(file);
  const previewUrl = `/api/files/${file.id}/preview`;
  const frameClass = compact
    ? "h-[min(72vh,760px)] min-h-[420px]"
    : "h-[min(72vh,820px)] min-h-[520px]";

  if (type === "image") {
    return (
      <div className={`grid ${frameClass} place-items-center overflow-auto rounded-2xl bg-[#eef1f5] p-4`}>
        {/* The source is a same-origin authenticated route that redirects to a short-lived signed URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={file.title}
          className="max-h-full max-w-full rounded-xl bg-white object-contain shadow-lg"
        />
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className={`grid ${frameClass} place-items-center overflow-hidden rounded-2xl bg-black p-2`}>
        <video
          controls
          preload="metadata"
          className="max-h-full max-w-full rounded-xl"
          src={previewUrl}
        >
          Your browser cannot play this video.
        </video>
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className={`grid ${frameClass} place-items-center rounded-2xl bg-gradient-to-br from-[#e8f0fe] to-white p-8`}>
        <div className="w-full max-w-xl rounded-[24px] border border-[#d2e3fc] bg-white p-8 text-center shadow-sm">
          <FileTypeIcon
            file={file}
            className="mx-auto size-20 rounded-[24px]"
            iconClassName="size-9"
          />
          <h3 className="mt-5 truncate text-lg font-semibold text-[#202124]">
            {file.title}
          </h3>
          <p className="mt-1 text-sm text-[#80868b]">
            {formatBytes(file.file_size)}
          </p>
          <audio controls preload="metadata" className="mt-6 w-full" src={previewUrl}>
            Your browser cannot play this audio file.
          </audio>
        </div>
      </div>
    );
  }

  if (type === "pdf" || type === "text") {
    return (
      <iframe
        title={`Preview ${file.title}`}
        src={previewUrl}
        className={`w-full ${frameClass} rounded-2xl border border-[#dadce0] bg-white`}
      />
    );
  }

  return (
    <div className={`grid ${frameClass} place-items-center rounded-2xl bg-white p-8 text-center`}>
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#f1f3f4] text-[#5f6368]">
          <EyeOff className="size-7" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-[#202124]">
          Preview is not available
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#5f6368]">
          This file type cannot be shown safely in the browser. Download it to
          open it with the appropriate application.
        </p>
        <a
          href={`/api/files/${file.id}/download`}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0]"
        >
          <Download className="size-4" aria-hidden="true" />
          Download file
        </a>
      </div>
    </div>
  );
}

export function FilePreviewStatus({ file }: { file: ImportantFile }) {
  return canPreviewFile(file) ? "Preview available" : "Download required";
}
