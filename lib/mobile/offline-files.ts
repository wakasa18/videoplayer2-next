"use client";

import type { ImportantFile } from "@/lib/files/types";
import { forgetOfflineFile, rememberOfflineFile } from "@/lib/mobile/offline-store";

const CACHE_NAME = "damons-private-offline-files-v1";

export function offlineCacheKey(fileId: number) {
  return `/__offline/files/${fileId}`;
}

export async function isFileAvailableOffline(fileId: number): Promise<boolean> {
  if (!("caches" in window)) return false;
  const cache = await caches.open(CACHE_NAME);
  return Boolean(await cache.match(offlineCacheKey(fileId)));
}

export async function cacheFileForOffline(file: ImportantFile, onProgress?: (label: string) => void) {
  if (!("caches" in window)) throw new Error("Offline file storage is not supported by this browser.");
  onProgress?.("Downloading private copy…");
  const response = await fetch(`/api/files/${file.id}/offline`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Could not download this file for offline access.");
  }
  const blob = await response.blob();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    offlineCacheKey(file.id),
    new Response(blob, {
      headers: {
        "Content-Type": file.mime_type || blob.type || "application/octet-stream",
        "Content-Length": String(blob.size),
        "X-Offline-Filename": encodeURIComponent(file.original_filename),
      },
    }),
  );
  rememberOfflineFile(file);
  onProgress?.("Available offline");
}

export async function removeOfflineFile(fileId: number) {
  if ("caches" in window) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(offlineCacheKey(fileId));
  }
  forgetOfflineFile(fileId);
}

export async function getOfflineFileBlob(fileId: number): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(offlineCacheKey(fileId));
  return response ? response.blob() : null;
}

export async function getOfflineFileObjectUrl(fileId: number): Promise<string | null> {
  const blob = await getOfflineFileBlob(fileId);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function clearOfflinePrivateFiles() {
  if ("caches" in window) await caches.delete(CACHE_NAME);
}
