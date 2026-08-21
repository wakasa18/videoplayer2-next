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
  pdf: "bg-[#fce8e6] text-[#c5221f]",
  image: "bg-[#f3e8fd] text-[#8430ce]",
  video: "bg-[#fce8f3] text-[#b80672]",
  audio: "bg-[#e6f4ea] text-[#137333]",
  document: "bg-[#e8f0fe] text-[#1967d2]",
  spreadsheet: "bg-[#e6f4ea] text-[#188038]",
  presentation: "bg-[#fef7e0] text-[#b06000]",
  archive: "bg-[#f1f3f4] text-[#5f6368]",
  text: "bg-[#e0f2f1] text-[#00796b]",
  other: "bg-[#f1f3f4] text-[#5f6368]",
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
      className={`grid shrink-0 place-items-center ${className} ${colorMap[type]}`}
      aria-hidden="true"
    >
      <Icon className={iconClassName} />
    </span>
  );
}
