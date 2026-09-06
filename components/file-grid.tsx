"use client";

import { CheckSquare } from "lucide-react";
import { useState } from "react";

import { BulkFileActions } from "@/components/bulk-file-actions";
import { FileCard } from "@/components/file-card";
import type { ImportantFile } from "@/lib/files/types";

export function FileGrid({ files }: { files: ImportantFile[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const ids = Array.from(selected);
  function toggle(id: number, value: boolean) {
    setSelected((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; });
  }
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setSelected(selected.size === files.length ? new Set() : new Set(files.map((file) => file.id)))} className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 text-xs font-semibold text-slate-400 hover:bg-white/[.06] hover:text-slate-200"><CheckSquare className="size-4" />{selected.size === files.length ? "Clear selection" : "Select all on page"}</button>
      </div>
      <BulkFileActions selectedIds={ids} onClear={() => setSelected(new Set())} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {files.map((file, index) => <FileCard key={file.id} file={file} index={index} selected={selected.has(file.id)} onSelectedChange={(value) => toggle(file.id, value)} />)}
      </div>
    </div>
  );
}
