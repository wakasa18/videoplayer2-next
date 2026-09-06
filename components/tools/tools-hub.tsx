"use client";

import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Download,
  FileArchive,
  FileCog,
  FileImage,
  FileText,
  Images,
  Layers3,
  ListRestart,
  FolderDown,
  HardDriveUpload,
  Loader2,
  PackageOpen,
  Scissors,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { formatBytes } from "@/lib/files/utils";
import { bytesToArrayBuffer } from "@/lib/tools/binary";
import { saveGeneratedFileToArchive } from "@/lib/tools/generated-upload-client";
import type { ToolArchiveFile } from "@/lib/tools/types";
import { createZipBlob, extractZipEntry, inspectZip, type ZipEntryInfo, type ZipSource } from "@/lib/tools/zip";
import { getPdfPageCount, imagesToPdf, mergePdfFiles, organizePdfPages, splitPdfIntoPages } from "@/lib/tools/pdf";

type ToolKey = "converter" | "pdf" | "image" | "archive";

type GeneratedOutput = {
  file: File;
  label: string;
  detail: string;
};

const MAX_BROWSER_BYTES = 256 * 1024 * 1024;

const TOOLS: Array<{
  key: ToolKey;
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof FileCog;
}> = [
  {
    key: "converter",
    label: "File Converter",
    eyebrow: "Convert",
    description: "Convert common image, text, CSV, JSON, HTML, and SVG files locally in your browser.",
    icon: FileCog,
  },
  {
    key: "pdf",
    label: "PDF Toolkit",
    eyebrow: "PDF",
    description: "Merge, split, extract, reorder, and build PDFs from images directly in your browser.",
    icon: FileText,
  },
  {
    key: "image",
    label: "Image Toolkit",
    eyebrow: "Edit",
    description: "Resize, crop, rotate, compress, convert, and strip metadata from images.",
    icon: FileImage,
  },
  {
    key: "archive",
    label: "Archive Manager",
    eyebrow: "ZIP",
    description: "Create, inspect, and extract ZIP archives, including files already stored in Important Files.",
    icon: FileArchive,
  },
];

export function ToolsHub({ archiveFiles }: { archiveFiles: ToolArchiveFile[] }) {
  const [active, setActive] = useState<ToolKey>("converter");

  return (
    <div className="space-y-5">
      <section className="tech-panel relative overflow-hidden rounded-[22px] p-4 sm:rounded-[30px] sm:p-8">
        <div className="tech-scanline" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-semibold text-cyan-200">
              <WandSparkles className="size-4" /> Archive utilities
            </div>
            <h1 className="tech-title text-3xl font-semibold tracking-[-.035em] text-slate-100 sm:text-4xl">
              Tools
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              Process files without leaving Damon&apos;s Archive. Work with local files or pull supported files directly from Important Files, then download the result or save it back to your archive.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <MiniFact icon={ShieldCheck} label="Private" value="Browser-first" />
            <MiniFact icon={HardDriveUpload} label="Output" value="Save to archive" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const selected = active === tool.key;
          return (
            <button
              key={tool.key}
              type="button"
              onClick={() => setActive(tool.key)}
              className={`tech-interactive group rounded-[24px] border p-5 text-left transition ${
                selected
                  ? "border-cyan-300/25 bg-[linear-gradient(145deg,rgba(28,206,255,.12),rgba(83,91,255,.08))] shadow-[0_18px_45px_rgba(0,104,180,.12)]"
                  : "border-white/10 bg-white/[0.035] hover:border-cyan-300/15 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className={`grid size-11 place-items-center rounded-2xl border ${selected ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-white/[0.04] text-slate-400 group-hover:text-cyan-200"}`}>
                  <Icon className="size-5" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{tool.eyebrow}</span>
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-100">{tool.label}</h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">{tool.description}</p>
            </button>
          );
        })}
      </section>

      {active === "converter" ? <FileConverter archiveFiles={archiveFiles} /> : null}
      {active === "pdf" ? <PdfToolkit archiveFiles={archiveFiles} /> : null}
      {active === "image" ? <ImageToolkit archiveFiles={archiveFiles} /> : null}
      {active === "archive" ? <ArchiveManager archiveFiles={archiveFiles} /> : null}
    </div>
  );
}

function FileConverter({ archiveFiles }: { archiveFiles: ToolArchiveFile[] }) {
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [archiveId, setArchiveId] = useState("");
  const [target, setTarget] = useState("png");
  const [quality, setQuality] = useState(88);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<GeneratedOutput | null>(null);

  const archiveFile = archiveFiles.find((file) => String(file.id) === archiveId) ?? null;
  const sourceName = localFile?.name ?? archiveFile?.originalFilename ?? "";
  const sourceMime = localFile?.type ?? archiveFile?.mimeType ?? "";
  const sourceExt = extensionOf(sourceName);
  const targets = converterTargets(sourceExt, sourceMime);

  const effectiveTarget = targets.some((item) => item.value === target)
    ? target
    : targets[0]?.value ?? "";

  async function convert() {
    setError("");
    setOutput(null);
    setBusy(true);
    try {
      const file = localFile ?? (archiveFile ? await fetchArchiveFile(archiveFile) : null);
      if (!file) throw new Error("Choose a local file or a file from Important Files first.");
      if (file.size > MAX_BROWSER_BYTES) throw new Error("This browser tool limits a single conversion to 256 MB.");
      const converted = await convertFile(file, effectiveTarget, quality / 100);
      setOutput({
        file: converted,
        label: "Conversion complete",
        detail: `${file.name} → ${converted.name}`,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not convert this file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolSurface icon={FileCog} title="File Converter" description="Useful browser-native conversions with no third-party upload service. Office document conversion is intentionally excluded because accurate DOCX/XLSX/PPTX conversion requires a dedicated document engine.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
        <div className="space-y-4">
          <SourceCard
            archiveFiles={archiveFiles.filter((file) => converterTargets(file.extension, file.mimeType).length > 0)}
            localFile={localFile}
            archiveId={archiveId}
            onLocalFile={(file) => { setLocalFile(file); setArchiveId(""); setOutput(null); }}
            onArchiveId={(value) => { setArchiveId(value); setLocalFile(null); setOutput(null); }}
            accept="image/*,.svg,.json,.csv,.txt,.md,.html,.htm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Convert to">
              <select value={effectiveTarget} onChange={(event) => setTarget(event.target.value)} className="tool-input" disabled={!sourceName}>
                {targets.length ? targets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>) : <option value="">Choose a supported source</option>}
              </select>
            </Field>
            <Field label="Image quality" hint="Used for JPG/WebP outputs">
              <div className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#08111f]/90 px-3">
                <input className="min-w-0 flex-1 accent-cyan-400" type="range" min="35" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
                <span className="w-10 text-right text-xs font-semibold text-cyan-200">{quality}%</span>
              </div>
            </Field>
          </div>
          <SupportedFormats />
          {error ? <ErrorBox message={error} /> : null}
          <button type="button" onClick={convert} disabled={busy || !sourceName || !targets.length} className="tool-primary-button">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? "Converting…" : "Convert file"}
          </button>
        </div>
        <GeneratedResult output={output} defaultFolder="Tools Output/Converted" />
      </div>
    </ToolSurface>
  );
}


function PdfToolkit({ archiveFiles }: { archiveFiles: ToolArchiveFile[] }) {
  type PdfMode = "merge" | "organize" | "split" | "images";
  const pdfFiles = archiveFiles.filter((file) => file.extension === "pdf" || file.mimeType === "application/pdf");
  const archiveImages = archiveFiles.filter((file) => ["png", "jpg", "jpeg"].includes(file.extension) || ["image/png", "image/jpeg"].includes(file.mimeType));
  const [mode, setMode] = useState<PdfMode>("merge");
  const [localPdfs, setLocalPdfs] = useState<File[]>([]);
  const [pdfSelections, setPdfSelections] = useState<Set<number>>(new Set());
  const [singleLocal, setSingleLocal] = useState<File | null>(null);
  const [singleArchiveId, setSingleArchiveId] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageOrder, setPageOrder] = useState("");
  const [localImages, setLocalImages] = useState<File[]>([]);
  const [imageSelections, setImageSelections] = useState<Set<number>>(new Set());
  const [outputName, setOutputName] = useState(`pdf-output-${timestampSlug()}.pdf`);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedPdfs = useMemo(() => pdfFiles.filter((file) => pdfSelections.has(file.id)), [pdfFiles, pdfSelections]);
  const selectedImages = useMemo(() => archiveImages.filter((file) => imageSelections.has(file.id)), [archiveImages, imageSelections]);
  const singleArchive = pdfFiles.find((file) => String(file.id) === singleArchiveId) ?? null;

  function changeMode(next: PdfMode) {
    setMode(next);
    setError("");
    setOutput(null);
    setPageCount(null);
    setOutputName(next === "split" ? `split-pages-${timestampSlug()}.zip` : `pdf-output-${timestampSlug()}.pdf`);
  }

  async function resolveSinglePdf(): Promise<File> {
    const file = singleLocal ?? (singleArchive ? await fetchArchiveFile(singleArchive) : null);
    if (!file) throw new Error("Choose a PDF from your device or Important Files first.");
    if (file.size > MAX_BROWSER_BYTES) throw new Error("PDF processing is limited to 256 MB per source file in the browser.");
    return file;
  }

  async function inspectPdf() {
    setError("");
    setBusy(true);
    try {
      const file = await resolveSinglePdf();
      setPageCount(await getPdfPageCount(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not inspect this PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function runPdfTool() {
    setError("");
    setOutput(null);
    setBusy(true);
    try {
      if (mode === "merge") {
        const total = localPdfs.reduce((sum, file) => sum + file.size, 0) + selectedPdfs.reduce((sum, file) => sum + file.fileSize, 0);
        if (total > MAX_BROWSER_BYTES) throw new Error("The selected PDFs exceed the 256 MB browser processing limit.");
        const inputs: File[] = [...localPdfs];
        for (const item of selectedPdfs) inputs.push(await fetchArchiveFile(item));
        const file = await mergePdfFiles(inputs, outputName);
        setOutput({ file, label: "PDFs merged", detail: `${inputs.length} PDF files combined into one document.` });
        return;
      }

      if (mode === "organize") {
        const source = await resolveSinglePdf();
        const result = await organizePdfPages(source, pageOrder, outputName);
        setPageCount(result.pageCount);
        setOutput({ file: result.file, label: "PDF pages organized", detail: `${result.selectedCount} page${result.selectedCount === 1 ? "" : "s"} copied in the exact order you entered.` });
        return;
      }

      if (mode === "split") {
        const source = await resolveSinglePdf();
        const pages = await splitPdfIntoPages(source);
        setPageCount(pages.length);
        const zip = await createZipBlob(await Promise.all(pages.map(async (file) => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }))));
        const safeName = outputName.trim().toLowerCase().endsWith(".zip") ? outputName.trim() : `${stemOf(outputName || source.name)}-pages.zip`;
        const file = new File([zip], safeName, { type: "application/zip", lastModified: Date.now() });
        setOutput({ file, label: "PDF split complete", detail: `${pages.length} one-page PDFs packaged into one ZIP archive.` });
        return;
      }

      const total = localImages.reduce((sum, file) => sum + file.size, 0) + selectedImages.reduce((sum, file) => sum + file.fileSize, 0);
      if (total > MAX_BROWSER_BYTES) throw new Error("The selected images exceed the 256 MB browser processing limit.");
      const inputs: File[] = [...localImages];
      for (const item of selectedImages) inputs.push(await fetchArchiveFile(item));
      const file = await imagesToPdf(inputs, outputName);
      setOutput({ file, label: "PDF created from images", detail: `${inputs.length} image${inputs.length === 1 ? "" : "s"} placed into a single PDF.` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not process this PDF operation.");
    } finally {
      setBusy(false);
    }
  }

  const modeButtons: Array<{ key: PdfMode; label: string; icon: typeof FileText }> = [
    { key: "merge", label: "Merge", icon: Layers3 },
    { key: "organize", label: "Extract / reorder", icon: ListRestart },
    { key: "split", label: "Split pages", icon: Scissors },
    { key: "images", label: "Images to PDF", icon: Images },
  ];

  return (
    <ToolSurface icon={FileText} title="PDF Toolkit" description="Merge PDFs, extract or reorder pages, split a PDF into individual pages, or turn PNG/JPG images into a PDF. Processing stays in your browser; generated files can be saved back to Important Files.">
      <div className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {modeButtons.map((item) => {
          const Icon = item.icon;
          return <button key={item.key} type="button" onClick={() => changeMode(item.key)} className={`rounded-2xl border px-4 py-3 text-left text-xs font-semibold transition ${mode === item.key ? "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200" : "border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.045] hover:text-slate-200"}`}><Icon className="mr-2 inline size-4" />{item.label}</button>;
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
        <div className="space-y-4">
          {mode === "merge" ? <>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
              <div><h3 className="text-sm font-semibold text-slate-100">PDF sources</h3><p className="mt-1 text-xs text-slate-500">Choose two or more local PDFs, archive PDFs, or a combination of both.</p></div>
              <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] p-3 text-center transition hover:bg-cyan-300/[0.06]"><UploadCloud className="size-5 text-cyan-300" /><span className="mt-2 text-xs font-semibold text-slate-200">Choose local PDFs</span><span className="mt-1 text-[11px] text-slate-500">{localPdfs.length ? `${localPdfs.length} selected` : "Multiple selection supported"}</span><input type="file" multiple accept=".pdf,application/pdf" className="sr-only" onChange={(event) => { setLocalPdfs(Array.from(event.target.files ?? [])); setOutput(null); }} /></label>
              <ArchiveSelectionList files={pdfFiles} selected={pdfSelections} onChange={setPdfSelections} emptyLabel="No PDF files are stored in Important Files yet." />
            </div>
            <Field label="Output file name"><input className="tool-input" value={outputName} onChange={(event) => setOutputName(event.target.value)} placeholder="merged.pdf" /></Field>
          </> : null}

          {mode === "organize" || mode === "split" ? <>
            <SourceCard archiveFiles={pdfFiles} localFile={singleLocal} archiveId={singleArchiveId} onLocalFile={(file) => { setSingleLocal(file); setSingleArchiveId(""); setPageCount(null); setOutput(null); }} onArchiveId={(value) => { setSingleArchiveId(value); setSingleLocal(null); setPageCount(null); setOutput(null); }} accept=".pdf,application/pdf" />
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><button type="button" onClick={inspectPdf} disabled={busy || (!singleLocal && !singleArchiveId)} className="tool-secondary-button">{busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Inspect PDF</button><span className="text-xs text-slate-500">{pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"} detected` : "Load page count before planning page ranges."}</span></div>
            {mode === "organize" ? <Field label="Pages and order" hint="Examples: 1-5 · 3,1,2 · 10-7 · leave blank for all pages"><input className="tool-input" value={pageOrder} onChange={(event) => setPageOrder(event.target.value)} placeholder={pageCount ? `1-${pageCount}` : "1,3,5-8"} /></Field> : null}
            <Field label="Output file name"><input className="tool-input" value={outputName} onChange={(event) => setOutputName(event.target.value)} placeholder={mode === "split" ? "split-pages.zip" : "organized.pdf"} /></Field>
          </> : null}

          {mode === "images" ? <>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
              <div><h3 className="text-sm font-semibold text-slate-100">Image sources</h3><p className="mt-1 text-xs text-slate-500">PNG and JPG/JPEG are supported. Use Image Toolkit first for WebP, GIF, BMP, or SVG.</p></div>
              <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] p-3 text-center transition hover:bg-cyan-300/[0.06]"><Images className="size-5 text-cyan-300" /><span className="mt-2 text-xs font-semibold text-slate-200">Choose local images</span><span className="mt-1 text-[11px] text-slate-500">{localImages.length ? `${localImages.length} selected` : "PNG or JPG · multiple selection supported"}</span><input type="file" multiple accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="sr-only" onChange={(event) => { setLocalImages(Array.from(event.target.files ?? [])); setOutput(null); }} /></label>
              <ArchiveSelectionList files={archiveImages} selected={imageSelections} onChange={setImageSelections} emptyLabel="No PNG/JPG files are stored in Important Files yet." />
            </div>
            <Field label="Output file name"><input className="tool-input" value={outputName} onChange={(event) => setOutputName(event.target.value)} placeholder="images.pdf" /></Field>
          </> : null}

          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.045] px-4 py-3 text-xs text-emerald-200/80"><ShieldCheck className="size-4 shrink-0" /> PDF processing happens locally in the browser. Password-encrypted PDFs must be unlocked first.</div>
          {error ? <ErrorBox message={error} /> : null}
          <button type="button" onClick={runPdfTool} disabled={busy} className="tool-primary-button">{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy ? "Processing…" : mode === "merge" ? "Merge PDFs" : mode === "organize" ? "Create organized PDF" : mode === "split" ? "Split PDF" : "Create PDF"}</button>
        </div>
        <GeneratedResult output={output} defaultFolder={mode === "split" ? "Tools Output/PDF/Split" : "Tools Output/PDF"} />
      </div>
    </ToolSurface>
  );
}

function ArchiveSelectionList({ files, selected, onChange, emptyLabel }: { files: ToolArchiveFile[]; selected: Set<number>; onChange: (next: Set<number>) => void; emptyLabel: string }) {
  return <div className="mt-3 rounded-2xl border border-white/10 bg-[#08111f]/55 p-3"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-semibold text-slate-400">From Important Files</span>{selected.size ? <button type="button" onClick={() => onChange(new Set())} className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200">Clear {selected.size}</button> : null}</div>{files.length ? <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">{files.map((file) => { const checked = selected.has(file.id); return <label key={file.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition ${checked ? "border-cyan-300/15 bg-cyan-300/[0.06]" : "border-transparent hover:bg-white/[0.035]"}`}><input type="checkbox" checked={checked} onChange={() => { const next = new Set(selected); if (next.has(file.id)) next.delete(file.id); else next.add(file.id); onChange(next); }} className="size-4 accent-cyan-400" /><span className="min-w-0 flex-1 truncate text-xs text-slate-300">{file.originalFilename}</span><span className="shrink-0 text-[10px] text-slate-600">{formatBytes(file.fileSize)}</span></label>; })}</div> : <p className="mt-2 text-[11px] text-slate-600">{emptyLabel}</p>}</div>;
}

function ImageToolkit({ archiveFiles }: { archiveFiles: ToolArchiveFile[] }) {
  const imageFiles = archiveFiles.filter((file) => file.mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(file.extension));
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [archiveId, setArchiveId] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [format, setFormat] = useState("webp");
  const [quality, setQuality] = useState(84);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState("original");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const localImageInputRef = useRef<HTMLInputElement>(null);

  function chooseLocalImages(files: FileList | File[]) {
    const incoming = Array.from(files);
    const supported = incoming.filter((file) => {
      const ext = extensionOf(file.name);
      return file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext);
    });

    const ignored = incoming.length - supported.length;
    setError(ignored > 0 ? `${ignored} unsupported file${ignored === 1 ? " was" : "s were"} ignored.` : "");
    setLocalFiles(supported);
    setArchiveId("");
    setOutput(null);
  }

  function clearLocalImages() {
    setLocalFiles([]);
    setArchiveId("");
    setOutput(null);
    setError("");
    if (localImageInputRef.current) localImageInputRef.current.value = "";
  }

  async function processImages() {
    setError("");
    setOutput(null);
    setBusy(true);
    try {
      const archiveFile = imageFiles.find((file) => String(file.id) === archiveId) ?? null;
      const inputs = localFiles.length ? localFiles : archiveFile ? [await fetchArchiveFile(archiveFile)] : [];
      if (!inputs.length) throw new Error("Choose one or more images first.");
      const total = inputs.reduce((sum, file) => sum + file.size, 0);
      if (total > MAX_BROWSER_BYTES) throw new Error("The selected images exceed the 256 MB browser processing limit.");

      const results: File[] = [];
      for (const file of inputs) {
        results.push(await transformImage(file, {
          width: positiveNumber(width),
          height: positiveNumber(height),
          format,
          quality: quality / 100,
          rotation,
          crop,
        }));
      }

      if (results.length === 1) {
        setOutput({ file: results[0], label: "Image ready", detail: "Metadata is removed automatically when the image is re-encoded." });
      } else {
        const zip = await createZipBlob(await Promise.all(results.map(async (file) => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }))));
        const packaged = new File([zip], `processed-images-${timestampSlug()}.zip`, { type: "application/zip" });
        setOutput({ file: packaged, label: `${results.length} images processed`, detail: "Batch results were packaged into one ZIP for easier download or archiving." });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not process these images.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolSurface icon={FileImage} title="Image Toolkit" description="Resize, center-crop, rotate, compress, convert, and remove metadata. Multiple local images are processed with the same settings and returned as one ZIP.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-slate-100">Image source</h3><p className="mt-1 text-xs text-slate-500">Choose multiple local images or one existing archive image.</p></div>
              {(localFiles.length || archiveId) ? <button type="button" onClick={clearLocalImages} className="tool-ghost-button"><X className="size-4" /> Clear</button> : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div
                className="group flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] p-4 text-center transition hover:bg-cyan-300/[0.06]"
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
                onDrop={(event) => { event.preventDefault(); chooseLocalImages(event.dataTransfer.files); }}
              >
                <UploadCloud className="size-6 text-cyan-300" />
                <span className="mt-2 text-sm font-semibold text-slate-200">Choose local images</span>
                <span className="mt-1 text-[11px] text-slate-500">PNG, JPG, WebP, GIF, BMP, SVG · drag & drop supported</span>
                <button type="button" onClick={() => localImageInputRef.current?.click()} className="tool-secondary-button mt-3">
                  <UploadCloud className="size-4" /> Browse images
                </button>
                <input
                  ref={localImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg"
                  multiple
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    chooseLocalImages(event.currentTarget.files ?? []);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <label className="text-xs font-semibold text-slate-300">From Important Files</label>
                <select value={archiveId} onChange={(event) => { setArchiveId(event.target.value); setLocalFiles([]); setOutput(null); }} className="tool-input mt-2">
                  <option value="">Choose an archive image…</option>
                  {imageFiles.map((file) => <option key={file.id} value={file.id}>{file.originalFilename} · {formatBytes(file.fileSize)}</option>)}
                </select>
                <p className="mt-2 truncate text-[11px] text-slate-500">{localFiles.length ? `${localFiles.length} local image${localFiles.length === 1 ? "" : "s"} selected` : archiveId ? "Archive image selected" : "No image selected"}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Width" hint="Leave blank to calculate automatically"><input className="tool-input" inputMode="numeric" value={width} onChange={(event) => setWidth(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Auto" /></Field>
            <Field label="Height" hint="Leave blank to preserve aspect"><input className="tool-input" inputMode="numeric" value={height} onChange={(event) => setHeight(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Auto" /></Field>
            <Field label="Crop"><select className="tool-input" value={crop} onChange={(event) => setCrop(event.target.value)}><option value="original">Keep original</option><option value="1:1">Square · 1:1</option><option value="4:3">Standard · 4:3</option><option value="16:9">Wide · 16:9</option></select></Field>
            <Field label="Output format"><select className="tool-input" value={format} onChange={(event) => setFormat(event.target.value)}><option value="webp">WebP</option><option value="jpeg">JPG</option><option value="png">PNG</option></select></Field>
            <Field label="Rotation"><select className="tool-input" value={rotation} onChange={(event) => setRotation(Number(event.target.value))}><option value={0}>No rotation</option><option value={90}>90° clockwise</option><option value={180}>180°</option><option value={270}>270° clockwise</option></select></Field>
            <Field label="Quality" hint="JPG/WebP compression"><div className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#08111f]/90 px-3"><input className="min-w-0 flex-1 accent-cyan-400" type="range" min="30" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /><span className="w-10 text-right text-xs font-semibold text-cyan-200">{quality}%</span></div></Field>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.045] px-4 py-3 text-xs text-emerald-200/80"><ShieldCheck className="size-4 shrink-0" /> Re-encoding removes EXIF/GPS metadata from the generated image.</div>
          {error ? <ErrorBox message={error} /> : null}
          <button type="button" onClick={processImages} disabled={busy || (!localFiles.length && !archiveId)} className="tool-primary-button">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <SlidersHorizontal className="size-4" />}
            {busy ? "Processing…" : `Process ${localFiles.length > 1 ? `${localFiles.length} images` : "image"}`}
          </button>
        </div>
        <GeneratedResult output={output} defaultFolder="Tools Output/Images" />
      </div>
    </ToolSurface>
  );
}

function ArchiveManager({ archiveFiles }: { archiveFiles: ToolArchiveFile[] }) {
  const zipFiles = archiveFiles.filter((file) => file.extension === "zip" || file.mimeType === "application/zip" || file.mimeType === "application/x-zip-compressed");
  const [mode, setMode] = useState<"create" | "extract">("create");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [archiveSelections, setArchiveSelections] = useState<Set<number>>(new Set());
  const [compress, setCompress] = useState(true);
  const [archiveName, setArchiveName] = useState(`archive-${timestampSlug()}.zip`);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [zipLocal, setZipLocal] = useState<File | null>(null);
  const [zipArchiveId, setZipArchiveId] = useState("");
  const [zipBuffer, setZipBuffer] = useState<ArrayBuffer | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipEntryInfo[]>([]);
  const [extractFolder, setExtractFolder] = useState("Tools Output/Extracted");
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractStatus, setExtractStatus] = useState("");
  const createFilesInputRef = useRef<HTMLInputElement>(null);
  const extractZipInputRef = useRef<HTMLInputElement>(null);

  function chooseArchiveFiles(files: FileList | File[]) {
    setLocalFiles(Array.from(files));
    setOutput(null);
    setError("");
  }

  function chooseLocalZip(file: File | null) {
    if (file && extensionOf(file.name) !== "zip" && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
      setError("Choose a ZIP archive to inspect or extract.");
      setZipLocal(null);
      return;
    }

    setError("");
    setZipLocal(file);
    setZipArchiveId("");
    setZipEntries([]);
    setZipBuffer(null);
    setExtractStatus("");
  }

  const selectedArchiveFiles = useMemo(() => archiveFiles.filter((file) => archiveSelections.has(file.id)), [archiveFiles, archiveSelections]);
  const createBytes = localFiles.reduce((sum, file) => sum + file.size, 0) + selectedArchiveFiles.reduce((sum, file) => sum + file.fileSize, 0);

  async function createArchive() {
    setError(""); setOutput(null); setBusy(true);
    try {
      if (!localFiles.length && !selectedArchiveFiles.length) throw new Error("Add files before creating the ZIP archive.");
      if (createBytes > MAX_BROWSER_BYTES) throw new Error("The selected files exceed the 256 MB browser creation limit.");
      const sources: ZipSource[] = [];
      for (const file of localFiles) sources.push({ name: file.webkitRelativePath || file.name, data: new Uint8Array(await file.arrayBuffer()), modifiedAt: new Date(file.lastModified) });
      for (const item of selectedArchiveFiles) {
        const file = await fetchArchiveFile(item);
        const prefix = item.folderPath ? `${item.folderPath}/` : "";
        sources.push({ name: `${prefix}${file.name}`, data: new Uint8Array(await file.arrayBuffer()), modifiedAt: new Date(file.lastModified) });
      }
      const blob = await createZipBlob(sources, { compress });
      const safeName = archiveName.trim().toLowerCase().endsWith(".zip") ? archiveName.trim() : `${archiveName.trim() || "archive"}.zip`;
      const file = new File([blob], safeName, { type: "application/zip" });
      setOutput({ file, label: "ZIP archive ready", detail: `${sources.length} file${sources.length === 1 ? "" : "s"} · ${formatBytes(file.size)}` });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create the ZIP archive."); }
    finally { setBusy(false); }
  }

  async function inspectArchive() {
    setError(""); setExtractStatus(""); setZipEntries([]); setZipBuffer(null); setExtractBusy(true);
    try {
      const archiveFile = zipFiles.find((file) => String(file.id) === zipArchiveId) ?? null;
      const file = zipLocal ?? (archiveFile ? await fetchArchiveFile(archiveFile) : null);
      if (!file) throw new Error("Choose a ZIP archive first.");
      if (file.size > MAX_BROWSER_BYTES) throw new Error("ZIP inspection is limited to 256 MB in the browser.");
      const buffer = await file.arrayBuffer();
      const entries = inspectZip(buffer);
      setZipBuffer(buffer); setZipEntries(entries);
      setExtractStatus(`${entries.filter((entry) => !entry.directory).length} file entries found.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not inspect this ZIP archive."); }
    finally { setExtractBusy(false); }
  }

  async function downloadEntry(entry: ZipEntryInfo) {
    if (!zipBuffer) return;
    setError("");
    try {
      const bytes = await extractZipEntry(zipBuffer, entry);
      const file = new File([bytesToArrayBuffer(bytes)], baseName(entry.name), { type: mimeFromFilename(entry.name) });
      downloadFile(file);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not extract this file."); }
  }

  async function saveAllExtracted() {
    if (!zipBuffer || !zipEntries.length) return;
    setError(""); setExtractBusy(true); setExtractStatus("");
    try {
      const files = zipEntries.filter((entry) => !entry.directory);
      let saved = 0;
      for (const entry of files) {
        const bytes = await extractZipEntry(zipBuffer, entry);
        const file = new File([bytesToArrayBuffer(bytes)], baseName(entry.name), { type: mimeFromFilename(entry.name) });
        const subfolder = parentPath(entry.name);
        await saveGeneratedFileToArchive(file, { folderPath: joinFolder(extractFolder, subfolder), description: "Extracted with Archive Manager", category: "Archive Tools" });
        saved += 1;
        setExtractStatus(`Saving extracted files… ${saved}/${files.length}`);
      }
      setExtractStatus(`${saved} file${saved === 1 ? "" : "s"} saved to Important Files.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save all extracted files."); }
    finally { setExtractBusy(false); }
  }

  return (
    <ToolSurface icon={FileArchive} title="Archive Manager" description="Create ZIPs from local and archived files, inspect ZIP contents before extracting, download individual entries, or save extracted files back into Important Files. ZIP is supported; RAR/7z decoding is not faked in the browser.">
      <div className="mb-5 inline-flex rounded-2xl border border-white/10 bg-white/[0.025] p-1">
        <button type="button" onClick={() => { setMode("create"); setError(""); }} className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${mode === "create" ? "bg-cyan-300/10 text-cyan-200" : "text-slate-500 hover:text-slate-200"}`}><Archive className="mr-2 inline size-4" /> Create ZIP</button>
        <button type="button" onClick={() => { setMode("extract"); setError(""); }} className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${mode === "extract" ? "bg-cyan-300/10 text-cyan-200" : "text-slate-500 hover:text-slate-200"}`}><PackageOpen className="mr-2 inline size-4" /> Inspect / extract</button>
      </div>

      {mode === "create" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
          <div className="space-y-4">
            <div
              className="group flex min-h-28 flex-col items-center justify-center rounded-[22px] border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] p-5 text-center transition hover:bg-cyan-300/[0.06]"
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
              onDrop={(event) => { event.preventDefault(); chooseArchiveFiles(event.dataTransfer.files); }}
            >
              <FolderDown className="size-7 text-cyan-300" />
              <span className="mt-2 text-sm font-semibold text-slate-200">Add local files</span>
              <span className="mt-1 text-[11px] text-slate-500">Select multiple files or drag them here, then combine them with Important Files.</span>
              <button type="button" onClick={() => createFilesInputRef.current?.click()} className="tool-secondary-button mt-3">
                <FolderDown className="size-4" /> Browse files
              </button>
              <input
                ref={createFilesInputRef}
                type="file"
                multiple
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  chooseArchiveFiles(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-100">Add from Important Files</h3><p className="mt-1 text-xs text-slate-500">Select one or more existing files.</p></div><span className="text-xs font-semibold text-cyan-300">{archiveSelections.size} selected</span></div>
              <div className="mt-3 max-h-60 space-y-1 overflow-y-auto pr-1">
                {archiveFiles.length ? archiveFiles.map((file) => {
                  const checked = archiveSelections.has(file.id);
                  return <label key={file.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked ? "border-cyan-300/15 bg-cyan-300/[0.06]" : "border-transparent hover:bg-white/[0.035]"}`}><input type="checkbox" checked={checked} onChange={() => setArchiveSelections((current) => { const next = new Set(current); if (next.has(file.id)) next.delete(file.id); else next.add(file.id); return next; })} className="size-4 accent-cyan-400" /><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-slate-200">{file.originalFilename}</strong><small className="mt-0.5 block truncate text-[10px] text-slate-500">{file.folderPath || "Important Files root"} · {formatBytes(file.fileSize)}</small></span></label>;
                }) : <p className="py-6 text-center text-xs text-slate-500">No archive files available.</p>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Archive name"><input className="tool-input" value={archiveName} onChange={(event) => setArchiveName(event.target.value)} /></Field>
              <Field label="Compression"><label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#08111f]/90 px-3 text-xs text-slate-300"><input type="checkbox" checked={compress} onChange={(event) => setCompress(event.target.checked)} className="size-4 accent-cyan-400" /> Compress when supported</label></Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{localFiles.length} local</span><span>•</span><span>{archiveSelections.size} archived</span><span>•</span><span>{formatBytes(createBytes)}</span><span>•</span><span>256 MB browser limit</span></div>
            {error ? <ErrorBox message={error} /> : null}
            <button type="button" onClick={createArchive} disabled={busy || (!localFiles.length && !archiveSelections.size)} className="tool-primary-button">{busy ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}{busy ? "Building ZIP…" : "Create ZIP archive"}</button>
          </div>
          <GeneratedResult output={output} defaultFolder="Tools Output/Archives" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div
              className="group flex min-h-28 flex-col items-center justify-center rounded-[22px] border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] p-4 text-center transition hover:bg-cyan-300/[0.06]"
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
              onDrop={(event) => { event.preventDefault(); chooseLocalZip(event.dataTransfer.files?.[0] ?? null); }}
            >
              <PackageOpen className="size-6 text-cyan-300" />
              <span className="mt-2 text-sm font-semibold text-slate-200">Choose local ZIP</span>
              <span className="mt-1 max-w-full truncate text-[11px] text-slate-500">{zipLocal?.name ?? "No local archive selected"}</span>
              <button type="button" onClick={() => extractZipInputRef.current?.click()} className="tool-secondary-button mt-3">
                <PackageOpen className="size-4" /> Browse ZIP
              </button>
              <input
                ref={extractZipInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  chooseLocalZip(event.currentTarget.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4"><label className="text-xs font-semibold text-slate-300">ZIP from Important Files</label><select value={zipArchiveId} onChange={(event) => { setZipArchiveId(event.target.value); setZipLocal(null); setZipEntries([]); setZipBuffer(null); }} className="tool-input mt-2"><option value="">Choose a ZIP…</option>{zipFiles.map((file) => <option key={file.id} value={file.id}>{file.originalFilename} · {formatBytes(file.fileSize)}</option>)}</select><button type="button" onClick={inspectArchive} disabled={extractBusy || (!zipLocal && !zipArchiveId)} className="tool-secondary-button mt-3 w-full">{extractBusy && !zipEntries.length ? <Loader2 className="size-4 animate-spin" /> : <PackageOpen className="size-4" />} Inspect archive</button></div>
          </div>
          {error ? <ErrorBox message={error} /> : null}
          {zipEntries.length ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.025]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><h3 className="text-sm font-semibold text-slate-100">Archive contents</h3><p className="mt-0.5 text-[11px] text-slate-500">{extractStatus}</p></div><span className="text-xs font-semibold text-cyan-300">{zipEntries.length} entries</span></div><div className="max-h-[430px] divide-y divide-white/[0.07] overflow-y-auto">{zipEntries.map((entry, index) => <div key={`${entry.name}-${index}`} className="flex items-center gap-3 px-4 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-400">{entry.directory ? <Archive className="size-4" /> : <FileArchive className="size-4" />}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-slate-200">{entry.name}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{entry.directory ? "Folder" : `${formatBytes(entry.uncompressedSize)} · ${entry.method === 0 ? "Stored" : entry.method === 8 ? "Deflate" : `Method ${entry.method}`}${entry.encrypted ? " · Encrypted" : ""}`}</span></div>{!entry.directory ? <button type="button" onClick={() => downloadEntry(entry)} className="tool-icon-button" title="Download extracted file"><Download className="size-4" /></button> : null}</div>)}</div></div>
            <aside className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4"><h3 className="text-sm font-semibold text-slate-100">Extract to Important Files</h3><p className="mt-1 text-xs leading-5 text-slate-500">Folder paths inside the ZIP are preserved below this destination.</p><Field label="Destination folder" className="mt-4"><input value={extractFolder} onChange={(event) => setExtractFolder(event.target.value)} className="tool-input" /></Field><button type="button" onClick={saveAllExtracted} disabled={extractBusy} className="tool-primary-button mt-4 w-full">{extractBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{extractBusy ? "Extracting…" : "Extract all to archive"}</button>{extractStatus ? <p className="mt-3 rounded-xl bg-cyan-300/[0.05] px-3 py-2 text-[11px] leading-5 text-cyan-200/80">{extractStatus}</p> : null}</aside>
          </div> : null}
        </div>
      )}
    </ToolSurface>
  );
}

function ToolSurface({ icon: Icon, title, description, children }: { icon: typeof FileCog; title: string; description: string; children: React.ReactNode }) {
  return <section className="tech-panel rounded-[22px] p-4 sm:rounded-[30px] sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-200"><Icon className="size-5" /></span><div><h2 className="text-xl font-semibold text-slate-100">{title}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">{description}</p></div></div>{children}</section>;
}

function SourceCard({ archiveFiles, localFile, archiveId, onLocalFile, onArchiveId, accept }: { archiveFiles: ToolArchiveFile[]; localFile: File | null; archiveId: string; onLocalFile: (file: File | null) => void; onArchiveId: (value: string) => void; accept: string }) {
  return <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4"><div className="mb-3"><h3 className="text-sm font-semibold text-slate-100">Source file</h3><p className="mt-1 text-xs text-slate-500">Choose from your device or use a file already stored in Important Files.</p></div><div className="grid gap-3 md:grid-cols-2"><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] p-3 text-center transition hover:bg-cyan-300/[0.06]"><UploadCloud className="size-5 text-cyan-300" /><span className="mt-2 max-w-full truncate text-xs font-semibold text-slate-200">{localFile?.name ?? "Choose local file"}</span><input type="file" accept={accept} className="sr-only" onChange={(event) => onLocalFile(event.target.files?.[0] ?? null)} /></label><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><label className="text-[11px] font-semibold text-slate-400">From Important Files</label><select value={archiveId} onChange={(event) => onArchiveId(event.target.value)} className="tool-input mt-2"><option value="">Choose archive file…</option>{archiveFiles.map((file) => <option key={file.id} value={file.id}>{file.originalFilename} · {formatBytes(file.fileSize)}</option>)}</select></div></div></div>;
}

function GeneratedResult({ output, defaultFolder }: { output: GeneratedOutput | null; defaultFolder: string }) {
  const router = useRouter();
  const [folder, setFolder] = useState(defaultFolder);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!output) return;
    setSaving(true); setMessage(""); setError("");
    try {
      await saveGeneratedFileToArchive(output.file, { folderPath: folder });
      setMessage("Saved to Important Files."); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the generated file."); }
    finally { setSaving(false); }
  }

  return <aside className="min-w-0 rounded-[20px] border border-white/10 bg-[linear-gradient(160deg,rgba(10,20,36,.86),rgba(9,15,29,.9))] p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><ArrowRight className="size-4" /></span><div><h3 className="text-sm font-semibold text-slate-100">Output</h3><p className="mt-0.5 text-[11px] text-slate-500">Download it or save it back to your archive.</p></div></div>{output ? <div className="mt-5 space-y-4"><div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.045] p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /><div className="min-w-0"><strong className="block text-sm text-slate-100">{output.label}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{output.detail}</p><p className="mt-2 truncate text-xs font-semibold text-emerald-200">{output.file.name} · {formatBytes(output.file.size)}</p></div></div></div><button type="button" onClick={() => downloadFile(output.file)} className="tool-secondary-button w-full"><Download className="size-4" /> Download result</button><Field label="Save to folder"><input className="tool-input" value={folder} onChange={(event) => setFolder(event.target.value)} /></Field><button type="button" onClick={save} disabled={saving} className="tool-primary-button w-full">{saving ? <Loader2 className="size-4 animate-spin" /> : <HardDriveUpload className="size-4" />}{saving ? "Saving…" : "Save to Important Files"}</button>{message ? <p className="text-xs font-semibold text-emerald-300">{message}</p> : null}{error ? <ErrorBox message={error} /> : null}</div> : <div className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center"><div><Sparkles className="mx-auto size-7 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-400">No result yet</p><p className="mt-1 text-xs leading-5 text-slate-600">Configure the tool and run it. Your generated file will appear here.</p></div></div>}</aside>;
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-slate-300"><span>{label}</span>{hint ? <small className="font-normal text-slate-600">{hint}</small> : null}</span>{children}</label>;
}

function MiniFact({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return <div className="min-w-32 rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500"><Icon className="size-3.5 text-cyan-300" /> {label}</div><strong className="mt-1.5 block text-xs font-semibold text-slate-200">{value}</strong></div>;
}

function ErrorBox({ message }: { message: string }) { return <div className="rounded-2xl border border-red-300/15 bg-red-400/[0.07] px-4 py-3 text-xs leading-5 text-red-200">{message}</div>; }

function SupportedFormats() {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Supported conversions</p><div className="mt-2 flex flex-wrap gap-2">{["PNG / JPG / WebP / SVG", "CSV → JSON", "JSON → CSV", "TXT / MD → HTML", "HTML → TXT", "JSON pretty / minify"].map((item) => <span key={item} className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-slate-400">{item}</span>)}</div></div>;
}

async function fetchArchiveFile(item: ToolArchiveFile): Promise<File> {
  const response = await fetch(`/api/files/${item.id}/tool-source`, { cache: "no-store" });
  const payload = await response.json() as { url?: string; name?: string; mimeType?: string; error?: string };
  if (!response.ok || !payload.url) throw new Error(payload.error || `Could not open ${item.originalFilename} for the tool.`);
  const source = await fetch(payload.url, { cache: "no-store" });
  if (!source.ok) throw new Error(`Could not read ${item.originalFilename} from private storage.`);
  const blob = await source.blob();
  return new File([blob], payload.name || item.originalFilename, { type: payload.mimeType || blob.type || item.mimeType, lastModified: Date.now() });
}

async function convertFile(file: File, target: string, quality: number): Promise<File> {
  const ext = extensionOf(file.name);
  const image = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext);
  if (image && ["png", "jpeg", "webp"].includes(target)) return transformImage(file, { width: null, height: null, format: target, quality, rotation: 0, crop: "original" });

  const text = await file.text();
  const stem = stemOf(file.name);
  if (target === "json-pretty") return textFile(`${stem}.json`, JSON.stringify(JSON.parse(text), null, 2), "application/json");
  if (target === "json-min") return textFile(`${stem}.min.json`, JSON.stringify(JSON.parse(text)), "application/json");
  if (target === "csv") {
    const value = JSON.parse(text) as unknown;
    if (!Array.isArray(value)) throw new Error("JSON → CSV requires a top-level array of objects.");
    return textFile(`${stem}.csv`, jsonToCsv(value), "text/csv;charset=utf-8");
  }
  if (target === "json") return textFile(`${stem}.json`, JSON.stringify(csvToJson(text), null, 2), "application/json");
  if (target === "html") {
    const html = ext === "md" ? markdownToHtml(text) : `<pre>${escapeHtml(text)}</pre>`;
    return textFile(`${stem}.html`, `<!doctype html><meta charset="utf-8"><title>${escapeHtml(stem)}</title>${html}`, "text/html;charset=utf-8");
  }
  if (target === "txt") {
    const plain = ["html", "htm"].includes(ext) ? new DOMParser().parseFromString(text, "text/html").body.textContent ?? "" : text;
    return textFile(`${stem}.txt`, plain, "text/plain;charset=utf-8");
  }
  throw new Error("That conversion is not available for this source file.");
}

function converterTargets(ext: string, mime: string): Array<{ value: string; label: string }> {
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) return [{ value: "png", label: "PNG image" }, { value: "jpeg", label: "JPG image" }, { value: "webp", label: "WebP image" }];
  if (ext === "json" || mime.includes("json")) return [{ value: "json-pretty", label: "JSON · formatted" }, { value: "json-min", label: "JSON · minified" }, { value: "csv", label: "CSV" }, { value: "txt", label: "Plain text" }];
  if (ext === "csv" || mime.includes("csv")) return [{ value: "json", label: "JSON" }, { value: "txt", label: "Plain text" }];
  if (["txt", "md"].includes(ext) || mime.startsWith("text/plain") || mime.includes("markdown")) return [{ value: "html", label: "HTML" }, { value: "txt", label: "Plain text" }];
  if (["html", "htm"].includes(ext) || mime.includes("text/html")) return [{ value: "txt", label: "Plain text" }];
  return [];
}

async function transformImage(file: File, settings: { width: number | null; height: number | null; format: string; quality: number; rotation: number; crop: string }): Promise<File> {
  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error(`Could not read the dimensions of ${file.name}.`);

  const cropRatio = settings.crop === "1:1" ? 1 : settings.crop === "4:3" ? 4 / 3 : settings.crop === "16:9" ? 16 / 9 : sourceWidth / sourceHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
  if (settings.crop !== "original") {
    if (sourceRatio > cropRatio) { sw = Math.round(sourceHeight * cropRatio); sx = Math.round((sourceWidth - sw) / 2); }
    else { sh = Math.round(sourceWidth / cropRatio); sy = Math.round((sourceHeight - sh) / 2); }
  }

  let targetWidth = settings.width ?? 0;
  let targetHeight = settings.height ?? 0;
  const ratio = sw / sh;
  if (!targetWidth && !targetHeight) { targetWidth = sw; targetHeight = sh; }
  else if (targetWidth && !targetHeight) targetHeight = Math.max(1, Math.round(targetWidth / ratio));
  else if (!targetWidth && targetHeight) targetWidth = Math.max(1, Math.round(targetHeight * ratio));
  targetWidth = Math.max(1, Math.min(12000, targetWidth));
  targetHeight = Math.max(1, Math.min(12000, targetHeight));

  const base = document.createElement("canvas"); base.width = targetWidth; base.height = targetHeight;
  const context = base.getContext("2d", { alpha: settings.format === "png" });
  if (!context) throw new Error("Canvas processing is unavailable in this browser.");
  if (settings.format === "jpeg") { context.fillStyle = "#ffffff"; context.fillRect(0, 0, base.width, base.height); }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

  const degrees = ((settings.rotation % 360) + 360) % 360;
  let canvas = base;
  if (degrees) {
    const rotated = document.createElement("canvas");
    const swap = degrees === 90 || degrees === 270;
    rotated.width = swap ? base.height : base.width; rotated.height = swap ? base.width : base.height;
    const rotatedContext = rotated.getContext("2d", { alpha: settings.format === "png" });
    if (!rotatedContext) throw new Error("Canvas rotation is unavailable in this browser.");
    if (settings.format === "jpeg") { rotatedContext.fillStyle = "#ffffff"; rotatedContext.fillRect(0, 0, rotated.width, rotated.height); }
    rotatedContext.translate(rotated.width / 2, rotated.height / 2); rotatedContext.rotate((degrees * Math.PI) / 180); rotatedContext.drawImage(base, -base.width / 2, -base.height / 2); canvas = rotated;
  }

  const mime = settings.format === "jpeg" ? "image/jpeg" : settings.format === "png" ? "image/png" : "image/webp";
  const blob = await canvasToBlob(canvas, mime, settings.quality);
  const extension = settings.format === "jpeg" ? "jpg" : settings.format;
  return new File([blob], `${stemOf(file.name)}.${extension}`, { type: mime, lastModified: Date.now() });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`This browser could not decode ${file.name}.`)); };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the output image.")), mime, quality));
}

function jsonToCsv(rows: unknown[]): string {
  const objects = rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
  if (objects.length !== rows.length) throw new Error("JSON → CSV requires every array item to be an object.");
  const headers = Array.from(new Set(objects.flatMap((row) => Object.keys(row))));
  if (!headers.length) return "";
  const escape = (value: unknown) => { const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
  return [headers.map(escape).join(","), ...objects.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\r\n");
}

function csvToJson(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) { if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; } else if (char === '"') quoted = false; else field += char; }
    else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field.replace(/\r$/, "")); if (row.some((value) => value.length) || rows.length === 0) rows.push(row);
  const headers = rows.shift()?.map((header, index) => header.trim() || `column_${index + 1}`) ?? [];
  return rows.filter((values) => values.some((value) => value.length)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function markdownToHtml(text: string): string {
  const inline = (value: string) => escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>");
  return text.split(/\r?\n/).map((line) => {
    if (/^###\s/.test(line)) return `<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`;
    if (/^##\s/.test(line)) return `<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`;
    if (/^#\s/.test(line)) return `<h1>${inline(line.replace(/^#\s+/, ""))}</h1>`;
    if (/^[-*]\s/.test(line)) return `<div>• ${inline(line.replace(/^[-*]\s+/, ""))}</div>`;
    return line.trim() ? `<p>${inline(line)}</p>` : "<br>";
  }).join("\n");
}

function textFile(name: string, text: string, type: string): File { return new File([text], name, { type, lastModified: Date.now() }); }
function downloadFile(file: File) { const url = URL.createObjectURL(file); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
function extensionOf(name: string) { const part = name.toLowerCase().split(".").pop(); return part && part !== name.toLowerCase() ? part : ""; }
function stemOf(name: string) { const index = name.lastIndexOf("."); return (index > 0 ? name.slice(0, index) : name).trim() || "converted"; }
function baseName(path: string) { return path.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) || "file"; }
function parentPath(path: string) { const parts = path.replace(/\\/g, "/").split("/").filter(Boolean); parts.pop(); return parts.join("/"); }
function joinFolder(...parts: string[]) { return parts.join("/").replace(/\\/g, "/").split("/").map((part) => part.trim()).filter((part) => part && part !== "." && part !== "..").join("/"); }
function positiveNumber(value: string): number | null { const parsed = Number.parseInt(value, 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function timestampSlug() { const now = new Date(); return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`; }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function mimeFromFilename(name: string) { const ext = extensionOf(name); const map: Record<string, string> = { txt: "text/plain", md: "text/markdown", html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", ts: "text/plain", json: "application/json", csv: "text/csv", xml: "application/xml", pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", mp3: "audio/mpeg", mp4: "video/mp4", zip: "application/zip" }; return map[ext] || "application/octet-stream"; }
