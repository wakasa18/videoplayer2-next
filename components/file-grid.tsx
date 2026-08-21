import { FileCard } from "@/components/file-card";
import type { ImportantFile } from "@/lib/files/types";

export function FileGrid({ files }: { files: ImportantFile[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {files.map((file, index) => (
        <FileCard key={file.id} file={file} index={index} />
      ))}
    </div>
  );
}
