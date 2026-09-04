"use client";

import { ModalPortal } from "@/components/ui/modal-portal";

import { AnimatePresence, motion } from "motion/react";
import { FolderPlus, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPath: string;
};

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentPath,
}: CreateFolderDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function createFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/files/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentPath }),
      });
      const payload = (await response.json()) as {
        error?: string;
        folder?: { path: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not create the folder.");
      }

      closeDialog(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create folder.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeDialog(force = false) {
    if (submitting && !force) return;
    setName("");
    setError("");
    onOpenChange(false);
  }

  return (
    <ModalPortal>
      <AnimatePresence>
      {open ? (
        <motion.div
          className="tech-modal-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-3 sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              closeDialog();
            }
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-folder-title"
            className="tech-modal-surface w-full max-w-md rounded-[28px] border p-5 sm:p-6"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 330, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                  <FolderPlus className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="new-folder-title" className="text-lg font-semibold text-slate-100">
                    New folder
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {parentPath || "Important Files"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06]"
                aria-label="Close"
                disabled={submitting}
                onClick={() => closeDialog()}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <form className="mt-6" onSubmit={createFolder}>
              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                Folder name
                <input
                  autoFocus
                  required
                  maxLength={255}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: Certificates"
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15"
                />
              </label>

              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </motion.p>
              ) : null}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => closeDialog()}
                  className="min-h-11 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FolderPlus className="size-4" aria-hidden="true" />
                  )}
                  Create
                </button>
              </div>
            </form>
          </motion.section>
        </motion.div>
      ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
