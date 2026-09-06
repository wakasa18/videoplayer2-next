"use client";

import { Camera, CheckCircle2, Download, FileText, ImagePlus, Loader2, ScanLine, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";

import { ModalPortal } from "@/components/ui/modal-portal";
import { buildScannedPdf } from "@/lib/mobile/document-scan";
import { enqueueMobileUpload } from "@/lib/mobile/offline-store";
import { saveGeneratedFileToArchive } from "@/lib/tools/generated-upload-client";

export function DocumentScanner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<File[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [name, setName] = useState("scanned-document.pdf");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<File | null>(null);
  const totalMb = useMemo(() => pages.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024, [pages]);

  function add(files: FileList | null) {
    if (!files?.length) return;
    setPages((current) => [...current, ...Array.from(files).filter((file) => file.type.startsWith("image/"))].slice(0, 30));
    setResult(null);
  }

  async function buildAndSave() {
    if (!pages.length || busy) return;
    setBusy(true);
    setStatus("Detecting page edges and building PDF…");
    try {
      const pdf = await buildScannedPdf(pages, name, enhance);
      setResult(pdf);
      if (!navigator.onLine) {
        await enqueueMobileUpload({ file: pdf, folderPath: "Mobile Scans", description: "Scanned on mobile", category: "Mobile Scan", compress: false });
        setStatus("Saved to the retry queue. It will upload when connection returns.");
      } else {
        await saveGeneratedFileToArchive(pdf, { folderPath: "Mobile Scans", description: "Scanned on mobile", category: "Mobile Scan" });
        setStatus("PDF saved to Important Files → Mobile Scans.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The scan could not be created.");
    } finally {
      setBusy(false);
    }
  }

  function downloadResult() {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <ModalPortal>
    <AnimatePresence>
      {open ? (
        <motion.div
          className="tech-modal-overlay fixed inset-0 z-[130] grid place-items-end p-0 sm:place-items-center sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(event) => event.currentTarget === event.target && onClose()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Document scanner"
            className="tech-modal-surface max-h-[94dvh] w-full overflow-y-auto rounded-t-[1.6rem] border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-2xl sm:rounded-[1.6rem] sm:p-6"
            initial={{ y: 34, opacity: 0.96, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.76 }}
          >
            <header className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><ScanLine className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-100">Camera Document Scanner</h2><p className="mt-1 text-xs leading-5 text-slate-400">Capture pages, auto-trim document edges, enhance readability, and save one PDF.</p></div><motion.button type="button" whileTap={{ scale: .9 }} onClick={onClose} className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-400"><X className="size-5" /></motion.button></header>
            <div className="mt-5 grid grid-cols-2 gap-2"><motion.button type="button" whileTap={{ scale: .97 }} onClick={() => inputRef.current?.click()} className="min-h-12 rounded-xl bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-3 text-sm font-semibold text-white"><Camera className="mr-2 inline size-4" />Scan page</motion.button><motion.button type="button" whileTap={{ scale: .97 }} onClick={() => galleryRef.current?.click()} className="min-h-12 rounded-xl border border-white/10 bg-white/[.045] px-3 text-sm font-semibold text-slate-200"><ImagePlus className="mr-2 inline size-4" />Choose photos</motion.button></div>
            <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" multiple onChange={(event) => { add(event.target.files); event.currentTarget.value = ""; }} />
            <input ref={galleryRef} hidden type="file" accept="image/*" multiple onChange={(event) => { add(event.target.files); event.currentTarget.value = ""; }} />
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-3"><div className="flex items-center justify-between gap-3"><div><strong className="text-sm text-slate-200">Pages</strong><p className="text-xs text-slate-500">{pages.length} page{pages.length === 1 ? "" : "s"} · {totalMb.toFixed(1)} MB source</p></div>{pages.length ? <motion.button type="button" whileTap={{ scale: .9 }} onClick={() => { setPages([]); setResult(null); }} className="grid size-9 place-items-center rounded-lg text-red-300 hover:bg-red-400/10"><Trash2 className="size-4" /></motion.button> : null}</div>{pages.length ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{pages.map((file, index) => <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .16 }} key={`${file.name}-${index}`} className="min-w-24 rounded-xl border border-white/10 bg-[#08111f] p-2"><FileText className="size-5 text-cyan-200" /><p className="mt-2 truncate text-[10px] text-slate-300">Page {index + 1}</p></motion.div>)}</div> : <p className="mt-3 text-xs text-slate-500">No pages captured yet.</p>}</div>
            <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm text-slate-300"><input type="checkbox" checked={enhance} onChange={(event) => setEnhance(event.target.checked)} className="size-4 accent-cyan-300" /><span><strong className="block text-slate-200">Enhance readability</strong><span className="text-xs text-slate-500">Auto-crop, grayscale, and boost contrast.</span></span></label>
            <label className="mt-4 block text-xs font-semibold text-slate-400">PDF filename<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/30" /></label>
            <AnimatePresence initial={false}>{status ? <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .16 }} className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[.06] p-3 text-xs leading-5 text-slate-300">{status.includes("saved") || status.includes("Saved") ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : null}{status}</motion.div> : null}</AnimatePresence>
            <div className="mt-5 flex flex-wrap justify-end gap-2">{result ? <motion.button type="button" whileTap={{ scale: .97 }} onClick={downloadResult} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-200"><Download className="mr-2 inline size-4" />Download copy</motion.button> : null}<motion.button type="button" whileTap={{ scale: .97 }} disabled={!pages.length || busy} onClick={() => void buildAndSave()} className="min-h-11 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="mr-2 inline size-4 animate-spin" /> : <ScanLine className="mr-2 inline size-4" />}Create & save PDF</motion.button></div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  </ModalPortal>;
}
