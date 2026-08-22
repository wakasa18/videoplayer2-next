"use client";

import { motion } from "motion/react";
import { Star } from "lucide-react";
import { useState } from "react";

import { FileItemActions } from "@/components/file-item-actions";
import { FileTypeIcon } from "@/components/file-type-icon";
import { PreviewDialog } from "@/components/preview-dialog";
import type { ImportantFile } from "@/lib/files/types";
import { canPreviewFile, formatBytes, formatDate } from "@/lib/files/utils";

export function FileList({ files }: { files: ImportantFile[] }) {
  return <div className="overflow-hidden rounded-[22px] border border-[#e1e5ea] bg-white shadow-sm"><div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(120px,.65fr)_minmax(130px,.7fr)_44px] gap-4 border-b border-[#e1e5ea] bg-[#f8f9fa] px-5 py-3 text-xs font-semibold text-[#5f6368] md:grid"><span>Name</span><span>Size</span><span>Modified</span><span className="sr-only">Actions</span></div><div className="divide-y divide-[#eef1f3]">{files.map((file, index) => <FileListRow key={file.id} file={file} index={index} />)}</div></div>;
}

function FileListRow({ file, index }: { file: ImportantFile; index: number }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return <>
    <motion.article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-[#f8fafd] md:grid-cols-[minmax(0,1.6fr)_minmax(120px,.65fr)_minmax(130px,.7fr)_44px] md:gap-4 md:px-5" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index, 20) * .025, duration: .2 }}>
      <button type="button" className="col-span-2 flex min-w-0 items-center gap-3 text-left md:col-span-1" onClick={() => canPreviewFile(file) && setPreviewOpen(true)}><FileTypeIcon file={file} className="size-11 rounded-xl" iconClassName="size-5" /><span className="min-w-0"><span className="flex items-center gap-1.5"><strong className="truncate text-sm font-semibold text-[#202124]">{file.title}</strong>{file.is_favorite ? <Star className="size-3.5 shrink-0 fill-[#f9ab00] text-[#f9ab00]" /> : null}</span><span className="mt-0.5 block truncate text-xs text-[#80868b] md:hidden">{formatBytes(file.file_size)} · {formatDate(file.updated_at ?? file.created_at)}</span><span className="mt-0.5 hidden truncate text-xs text-[#80868b] sm:block">{file.original_filename}</span></span></button>
      <span className="hidden text-sm text-[#5f6368] md:block">{formatBytes(file.file_size)}</span><span className="hidden text-sm text-[#5f6368] md:block">{formatDate(file.updated_at ?? file.created_at)}</span>
      <div className="justify-self-end"><FileItemActions file={file} onPreview={canPreviewFile(file) ? () => setPreviewOpen(true) : undefined} /></div>
    </motion.article>
    <PreviewDialog file={file} open={previewOpen} onClose={() => setPreviewOpen(false)} />
  </>;
}
