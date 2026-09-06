"use client";

const IMAGE_MIN_BYTES = 900 * 1024;
const MAX_IMAGE_EDGE = 2200;

export async function compressMobileUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < IMAGE_MIN_BYTES) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const preserveAlpha = file.type === "image/png" || file.type === "image/webp";
    const context = canvas.getContext("2d", { alpha: preserveAlpha });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType = preserveAlpha ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.82));
    if (!blob || blob.size >= file.size * 0.94) return file;
    const extension = outputType === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "mobile-photo";
    return new File([blob], `${base}.${extension}`, { type: outputType, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export function shouldOfferMobileCompression(file: File) {
  return file.type.startsWith("image/") && file.size >= IMAGE_MIN_BYTES;
}

export function isLargeMobileVideo(file: File) {
  return file.type.startsWith("video/") && file.size >= 60 * 1024 * 1024;
}
