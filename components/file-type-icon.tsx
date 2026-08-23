import {
  Archive,
  File,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";

import type { ImportantFile } from "@/lib/files/types";
import { getFileType } from "@/lib/files/utils";

const iconMap = {
  pdf: FileText,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: Archive,
  text: FileCode2,
  other: File,
};

const colorMap = {
  pdf: "bg-red-400/10 text-red-300 ring-1 ring-inset ring-red-300/20",
  image: "bg-purple-400/10 text-purple-300 ring-1 ring-inset ring-purple-300/20",
  video: "bg-pink-400/10 text-pink-300 ring-1 ring-inset ring-pink-300/20",
  audio: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-300/20",
  document: "bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-300/20",
  spreadsheet: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-300/20",
  presentation: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-300/20",
  archive: "bg-white/5 text-slate-300 ring-1 ring-inset ring-white/10",
  text: "bg-teal-400/10 text-teal-300 ring-1 ring-inset ring-teal-300/20",
  other: "bg-white/5 text-slate-300 ring-1 ring-inset ring-white/10",
};

type FileTypeIconProps = {
  file: ImportantFile;
  className?: string;
  iconClassName?: string;
};

export function FileTypeIcon({
  file,
  className = "size-12 rounded-2xl",
  iconClassName = "size-6",
}: FileTypeIconProps) {
  const type = getFileType(file);
  const Icon = iconMap[type];

  return (
    <span
      className={`grid shrink-0 place-items-center transition-transform duration-300 group-hover:scale-105 ${className} ${colorMap[type]}`}
      aria-hidden="true"
    >
      <Icon className={iconClassName} />
    </span>
  );
}
