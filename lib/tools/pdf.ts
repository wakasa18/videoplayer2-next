import { PDFDocument } from "pdf-lib";

import { bytesToArrayBuffer } from "./binary";

export type PdfPageSelection = {
  indexes: number[];
  label: string;
};

export async function getPdfPageCount(file: File): Promise<number> {
  const document = await loadPdf(file);
  return document.getPageCount();
}

export async function mergePdfFiles(files: File[], outputName: string): Promise<File> {
  if (files.length < 2) throw new Error("Choose at least two PDF files to merge.");
  const output = await PDFDocument.create();
  for (const file of files) {
    const source = await loadPdf(file);
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);
  }
  return pdfFile(normalizePdfName(outputName, "merged.pdf"), await output.save({ useObjectStreams: true }));
}

export async function organizePdfPages(file: File, pageExpression: string, outputName: string): Promise<{ file: File; pageCount: number; selectedCount: number }> {
  const source = await loadPdf(file);
  const pageCount = source.getPageCount();
  const selection = parsePdfPageSelection(pageExpression, pageCount);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, selection.indexes);
  for (const page of pages) output.addPage(page);
  return {
    file: pdfFile(normalizePdfName(outputName, `${stemOf(file.name)}-organized.pdf`), await output.save({ useObjectStreams: true })),
    pageCount,
    selectedCount: selection.indexes.length,
  };
}

export async function splitPdfIntoPages(file: File): Promise<File[]> {
  const source = await loadPdf(file);
  const pageCount = source.getPageCount();
  if (!pageCount) throw new Error("This PDF does not contain any pages.");
  const width = Math.max(2, String(pageCount).length);
  const files: File[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page);
    files.push(pdfFile(`${stemOf(file.name)}-page-${String(index + 1).padStart(width, "0")}.pdf`, await output.save({ useObjectStreams: true })));
  }
  return files;
}

export async function imagesToPdf(files: File[], outputName: string): Promise<File> {
  if (!files.length) throw new Error("Choose one or more PNG or JPG images first.");
  const output = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lower = file.name.toLowerCase();
    const mime = file.type.toLowerCase();
    const embedded = mime === "image/png" || lower.endsWith(".png")
      ? await output.embedPng(bytes)
      : mime === "image/jpeg" || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
        ? await output.embedJpg(bytes)
        : null;
    if (!embedded) throw new Error(`${file.name} is not a PNG or JPG image. Convert it with Image Toolkit first.`);

    const maxWidth = 595.28;
    const maxHeight = 841.89;
    const margin = 28;
    const availableWidth = maxWidth - margin * 2;
    const availableHeight = maxHeight - margin * 2;
    const scale = Math.min(availableWidth / embedded.width, availableHeight / embedded.height, 1);
    const width = Math.max(1, embedded.width * scale);
    const height = Math.max(1, embedded.height * scale);
    const pageWidth = Math.max(width + margin * 2, 240);
    const pageHeight = Math.max(height + margin * 2, 240);
    const page = output.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
  }
  return pdfFile(normalizePdfName(outputName, "images.pdf"), await output.save({ useObjectStreams: true }));
}

export function parsePdfPageSelection(expression: string, pageCount: number): PdfPageSelection {
  const trimmed = expression.trim();
  if (!trimmed) {
    const indexes = Array.from({ length: pageCount }, (_, index) => index);
    return { indexes, label: `All ${pageCount} pages` };
  }

  const indexes: number[] = [];
  for (const rawToken of trimmed.split(",")) {
    const token = rawToken.trim();
    if (!token) continue;
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      assertPage(start, pageCount);
      assertPage(end, pageCount);
      const step = start <= end ? 1 : -1;
      for (let page = start; ; page += step) {
        indexes.push(page - 1);
        if (page === end) break;
      }
      continue;
    }
    if (!/^\d+$/.test(token)) throw new Error(`Invalid page token: “${token}”. Use values like 1,3,5-8.`);
    const page = Number(token);
    assertPage(page, pageCount);
    indexes.push(page - 1);
  }

  if (!indexes.length) throw new Error("Choose at least one page.");
  return { indexes, label: `${indexes.length} page${indexes.length === 1 ? "" : "s"}` };
}

async function loadPdf(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted") || message.includes("password")) {
      throw new Error(`${file.name} is password-encrypted. Unlock the PDF before using browser PDF tools.`);
    }
    throw new Error(`Could not read ${file.name} as a valid PDF.`);
  }
}

function assertPage(page: number, pageCount: number) {
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw new Error(`Page ${page} is outside this PDF. Valid pages are 1–${pageCount}.`);
  }
}

function normalizePdfName(value: string, fallback: string): string {
  const clean = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  const name = clean || fallback;
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

function pdfFile(name: string, bytes: Uint8Array): File {
  return new File([bytesToArrayBuffer(bytes)], name, { type: "application/pdf", lastModified: Date.now() });
}

function stemOf(name: string): string {
  const index = name.lastIndexOf(".");
  return (index > 0 ? name.slice(0, index) : name).trim() || "document";
}
