"use client";

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
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#202124]/45 p-4 backdrop-blur-[3px]"
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
            className="w-full max-w-md rounded-[28px] border border-[#dadce0] bg-white p-6 shadow-[0_18px_48px_rgba(32,33,36,.24)]"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 330, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
                  <FolderPlus className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="new-folder-title" className="text-lg font-semibold text-[#202124]">
                    New folder
                  </h2>
                  <p className="mt-1 text-xs text-[#80868b]">
                    {parentPath || "Important Files"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"
                aria-label="Close"
                disabled={submitting}
                onClick={() => closeDialog()}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <form className="mt-6" onSubmit={createFolder}>
              <label className="grid gap-2 text-sm font-semibold text-[#3c4043]">
                Folder name
                <input
                  autoFocus
                  required
                  maxLength={255}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: Certificates"
                  className="min-h-12 rounded-2xl border border-[#dadce0] px-4 text-sm font-medium outline-none transition focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]"
                />
              </label>

              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-2xl border border-[#f6c7c3] bg-[#fce8e6] px-4 py-3 text-sm text-[#a50e0e]"
                >
                  {error}
                </motion.p>
              ) : null}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => closeDialog()}
                  className="min-h-11 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-60"
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
  );
}
