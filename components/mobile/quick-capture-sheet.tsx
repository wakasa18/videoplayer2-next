"use client";

import { Camera, FileUp, Image, Loader2, ScanLine, Video, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

import { DocumentScanner } from "@/components/mobile/document-scanner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { compressMobileUpload, isLargeMobileVideo } from "@/lib/mobile/compression";
import { enqueueMobileUpload } from "@/lib/mobile/offline-store";
import { saveGeneratedFileToArchive } from "@/lib/tools/generated-upload-client";

export function QuickCaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [compress, setCompress] = useState(true);

  async function handleFiles(list: FileList | null) {
    if (!list?.length || busy) return;
    const files = Array.from(list).slice(0, 20);
    setBusy(true);
    setStatus(`Preparing ${files.length} file${files.length === 1 ? "" : "s"}…`);
    const folderPath = `Mobile Uploads/${new Date().toISOString().slice(0, 10)}`;
    let uploaded = 0;
    let queued = 0;
    try {
      for (const original of files) {
        const file = compress ? await compressMobileUpload(original) : original;
        if (isLargeMobileVideo(original) && compress) {
          setStatus("Large videos use resumable upload; photo compression is applied automatically when possible.");
        }
        if (!navigator.onLine) {
          await enqueueMobileUpload({ file, folderPath, description: "Uploaded from mobile quick capture", category: "Mobile Upload", compress: false });
          queued += 1;
          continue;
        }
        try {
          await saveGeneratedFileToArchive(file, { folderPath, description: "Uploaded from mobile quick capture", category: "Mobile Upload" });
          uploaded += 1;
        } catch {
          await enqueueMobileUpload({ file, folderPath, description: "Uploaded from mobile quick capture", category: "Mobile Upload", compress: false });
          queued += 1;
        }
      }
      setStatus(`${uploaded ? `${uploaded} uploaded` : ""}${uploaded && queued ? " · " : ""}${queued ? `${queued} queued for retry` : ""}.`);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <ModalPortal>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="tech-modal-overlay fixed inset-0 z-[120] flex items-end lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onMouseDown={(event) => event.currentTarget === event.target && onClose()}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Quick mobile upload"
              className="tech-modal-surface max-h-[calc(100dvh-env(safe-area-inset-top)-.5rem)] w-full overflow-y-auto rounded-t-[1.7rem] border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 430, damping: 38, mass: 0.78 }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
              <header className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-100">Quick mobile upload</h2>
                  <p className="mt-1 text-xs text-slate-400">Capture or choose content and save it directly to Important Files.</p>
                </div>
                <motion.button type="button" onClick={onClose} whileTap={{ scale: 0.9 }} className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-400">
                  <X className="size-5" />
                </motion.button>
              </header>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Action icon={Camera} label="Take photo" onClick={() => photoRef.current?.click()} />
                <Action icon={Video} label="Record video" onClick={() => videoRef.current?.click()} />
                <Action icon={Image} label="Gallery" onClick={() => galleryRef.current?.click()} />
                <Action icon={FileUp} label="Upload file" onClick={() => fileRef.current?.click()} />
                <motion.button type="button" whileTap={{ scale: 0.975 }} onClick={() => setScannerOpen(true)} className="col-span-2 flex min-h-13 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.07] px-3 text-sm font-semibold text-cyan-200">
                  <ScanLine className="size-5" />Scan document to PDF
                </motion.button>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                <input type="checkbox" checked={compress} onChange={(event) => setCompress(event.target.checked)} className="size-4 accent-cyan-300" />
                <span><strong className="block text-xs text-slate-200">Smart mobile compression</strong><span className="text-[11px] leading-4 text-slate-500">Large camera photos are resized/compressed before upload. Videos stay original when the browser has no safe transcoder and continue through resumable upload.</span></span>
              </label>

              <AnimatePresence initial={false}>
                {status ? (
                  <motion.p
                    className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs leading-5 text-slate-300"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                  >
                    {busy ? <Loader2 className="mr-2 inline size-4 animate-spin text-cyan-200" /> : null}{status}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <input ref={photoRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => { void handleFiles(event.target.files); event.currentTarget.value = ""; }} />
              <input ref={videoRef} hidden type="file" accept="video/*" capture="environment" onChange={(event) => { void handleFiles(event.target.files); event.currentTarget.value = ""; }} />
              <input ref={galleryRef} hidden type="file" accept="image/*,video/*" multiple onChange={(event) => { void handleFiles(event.target.files); event.currentTarget.value = ""; }} />
              <input ref={fileRef} hidden type="file" multiple onChange={(event) => { void handleFiles(event.target.files); event.currentTarget.value = ""; }} />
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
    <DocumentScanner open={scannerOpen} onClose={() => setScannerOpen(false)} />
  </>;
}

function Action({ icon: Icon, label, onClick }: { icon: typeof Camera; label: string; onClick: () => void }) { return <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.965 }} transition={{ type: "spring", stiffness: 520, damping: 38 }} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.035] text-sm font-semibold text-slate-200 active:bg-white/[.08]"><Icon className="size-5 text-cyan-200" />{label}</motion.button>; }
