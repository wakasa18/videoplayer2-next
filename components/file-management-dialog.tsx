/* eslint-disable react-hooks/set-state-in-effect -- dialog state resets when reopened and folder loading begins asynchronously */
"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, FilePenLine, FolderInput, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { ImportantFile } from "@/lib/files/types";

type FileDialogMode = "edit" | "move" | "trash";

type FileManagementDialogProps = {
  file: ImportantFile;
  mode: FileDialogMode | null;
  onClose: () => void;
};

type FolderOption = { path: string; name: string; parent_path: string | null };

export function FileManagementDialog({
  file,
  mode,
  onClose,
}: FileManagementDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState(file.title);
  const [originalName, setOriginalName] = useState(file.original_filename);
  const [description, setDescription] = useState(file.description ?? "");
  const [category, setCategory] = useState(file.category ?? "");
  const [documentDate, setDocumentDate] = useState(file.document_date ?? "");
  const [destination, setDestination] = useState(file.folder_path ?? "");
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mode) return;
    setTitle(file.title);
    setOriginalName(file.original_filename);
    setDescription(file.description ?? "");
    setCategory(file.category ?? "");
    setDocumentDate(file.document_date ?? "");
    setDestination(file.folder_path ?? "");
    setError("");
  }, [file, mode]);

  useEffect(() => {
    if (mode !== "move") return;
    let cancelled = false;
    setLoadingFolders(true);
    fetch("/api/files/folders", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load folders.");
        if (!cancelled) setFolders(payload.folders ?? []);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load folders.");
      })
      .finally(() => {
        if (!cancelled) setLoadingFolders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const heading = useMemo(() => {
    if (mode === "edit") return "Edit file details";
    if (mode === "move") return "Move file";
    return "Move file to Recycle Bin?";
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!mode || submitting) return;
    setSubmitting(true);
    setError("");

    const body =
      mode === "edit"
        ? {
            action: "metadata",
            title,
            originalName,
            description,
            category,
            documentDate,
          }
        : mode === "move"
          ? { action: "move", folderPath: destination }
          : { action: "trash" };

    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The file could not be updated.");
      onClose();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The file could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {mode ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#020611]/75 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !submitting) onClose();
          }}
        >
          <motion.form
            onSubmit={submit}
            className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220]/95 shadow-[0_24px_70px_rgba(0,4,14,0.6)] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 330, damping: 28 }}
          >
            <div className="flex items-start gap-4 border-b border-white/10 p-5 sm:p-6">
              <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${mode === "trash" ? "bg-red-400/10 text-red-300" : "bg-cyan-400/10 text-cyan-300"}`}>
                {mode === "edit" ? <FilePenLine className="size-5" /> : mode === "move" ? <FolderInput className="size-5" /> : <Trash2 className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-100">{heading}</h2>
                <p className="mt-1 truncate text-sm text-slate-400">{file.original_filename}</p>
              </div>
              <button type="button" onClick={onClose} disabled={submitting} className="grid size-10 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] disabled:opacity-50">
                <X className="size-5" /><span className="sr-only">Close</span>
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              {mode === "edit" ? (
                <>
                  <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={255} className={inputClass} /></Field>
                  <Field label="Download filename"><input value={originalName} onChange={(event) => setOriginalName(event.target.value)} required maxLength={255} className={inputClass} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Category"><input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={100} placeholder="Optional" className={inputClass} /></Field>
                    <Field label="Document date"><input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className={inputClass} /></Field>
                  </div>
                  <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={4} placeholder="Optional" className={`${inputClass} min-h-28 resize-y py-3`} /></Field>
                </>
              ) : null}

              {mode === "move" ? (
                <Field label="Destination">
                  <select value={destination} onChange={(event) => setDestination(event.target.value)} disabled={loadingFolders} className={inputClass}>
                    <option value="">Important Files root</option>
                    {folders.map((folder) => <option key={folder.path} value={folder.path}>{folder.path}</option>)}
                  </select>
                  {loadingFolders ? <span className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="size-3.5 animate-spin" /> Loading folders…</span> : null}
                </Field>
              ) : null}

              {mode === "trash" ? (
                <div className="flex gap-3 rounded-2xl border border-red-300/25 bg-red-400/10 p-4 text-sm leading-6 text-red-300">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  <p>The file will remain recoverable from the Recycle Bin until you permanently delete it.</p>
                </div>
              ) : null}

              {error ? <div role="alert" className="rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-white/10 p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 hover:bg-white/[0.06] disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={submitting || loadingFolders} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60 ${mode === "trash" ? "bg-[linear-gradient(135deg,#fb7185,#ef4444)] hover:brightness-110" : "bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] hover:brightness-110"}`}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "edit" ? "Save changes" : mode === "move" ? "Move file" : "Move to Recycle Bin"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>;
}

const inputClass = "min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15 disabled:bg-white/[0.035]";
