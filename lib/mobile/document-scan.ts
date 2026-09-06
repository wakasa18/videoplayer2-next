"use client";

import { imagesToPdf } from "@/lib/tools/pdf";

export async function buildScannedPdf(images: File[], outputName: string, enhance = true): Promise<File> {
  if (!images.length) throw new Error("Capture or choose at least one document page.");
  const processed: File[] = [];
  for (let index = 0; index < images.length; index += 1) {
    processed.push(await processDocumentImage(images[index], index, enhance));
  }
  return imagesToPdf(processed, outputName || "scanned-document.pdf");
}

async function processDocumentImage(file: File, index: number, enhance: boolean): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 2400;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const sourceWidth = Math.max(1, Math.round(bitmap.width * scale));
  const sourceHeight = Math.max(1, Math.round(bitmap.height * scale));
  const source = document.createElement("canvas");
  source.width = sourceWidth;
  source.height = sourceHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("This browser could not process the scanned page.");
  sourceContext.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
  bitmap.close();

  const bounds = detectDocumentBounds(sourceContext, sourceWidth, sourceHeight);
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d", { willReadFrequently: enhance });
  if (!context) throw new Error("This browser could not render the scanned page.");
  context.drawImage(source, bounds.left, bounds.top, width, height, 0, 0, width, height);

  if (enhance) {
    const image = context.getImageData(0, 0, width, height);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.24 + 139));
      image.data[offset] = contrasted;
      image.data[offset + 1] = contrasted;
      image.data[offset + 2] = contrasted;
    }
    context.putImageData(image, 0, 0);
  }

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("The scanned page could not be encoded.");
  return new File([blob], `scan-page-${String(index + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

function detectDocumentBounds(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height).data;
  const cornerSize = Math.max(4, Math.round(Math.min(width, height) * 0.025));
  const samples: number[] = [];
  const cornerPoints = [
    [0, 0], [width - cornerSize, 0], [0, height - cornerSize], [width - cornerSize, height - cornerSize],
  ];
  for (const [startX, startY] of cornerPoints) {
    for (let y = startY; y < Math.min(height, startY + cornerSize); y += 3) {
      for (let x = startX; x < Math.min(width, startX + cornerSize); x += 3) {
        const offset = (y * width + x) * 4;
        samples.push(luma(image[offset], image[offset + 1], image[offset + 2]));
      }
    }
  }
  const background = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 245;
  const threshold = 34;
  const step = Math.max(2, Math.round(Math.min(width, height) / 500));
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  let hits = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      const value = luma(image[offset], image[offset + 1], image[offset + 2]);
      if (Math.abs(value - background) > threshold) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        hits += 1;
      }
    }
  }
  if (hits < 50 || right <= left || bottom <= top) return { left: 0, top: 0, right: width, bottom: height };
  const marginX = Math.round(width * 0.018);
  const marginY = Math.round(height * 0.018);
  return {
    left: Math.max(0, left - marginX),
    top: Math.max(0, top - marginY),
    right: Math.min(width, right + marginX + step),
    bottom: Math.min(height, bottom + marginY + step),
  };
}

function luma(r: number, g: number, b: number) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}
