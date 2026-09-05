"use client";

import { createClient } from "@/lib/supabase/client";

export type ResumablePreparedUpload = {
  fileId: number;
  uploadToken: string;
  objectPath: string;
};

const CHUNK_SIZE = 6 * 1024 * 1024;
const TUS_VERSION = "1.0.0";

export function resumableFingerprint(file: File, objectPath: string): string {
  return `${file.name}:${file.size}:${file.lastModified}:${objectPath}`;
}

export async function uploadResumable(
  file: File,
  prepared: ResumablePreparedUpload,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !apiKey) throw new Error("Supabase browser configuration is missing.");
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your login session expired. Sign in again.");

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/upload/resumable`;
  const key = `damons:tus:${resumableFingerprint(file, prepared.objectPath)}`;
  let location = readLocation(key);
  let offset = 0;

  if (location) {
    try {
      offset = await getOffset(location, session.access_token, apiKey, signal);
      if (offset > file.size) throw new Error("Invalid resumable offset.");
    } catch {
      location = null;
      window.localStorage.removeItem(key);
    }
  }

  if (!location) {
    const metadata = [
      ["bucketName", process.env.NEXT_PUBLIC_SUPABASE_FILES_BUCKET || "important-files"],
      ["objectName", prepared.objectPath],
      ["contentType", file.type || "application/octet-stream"],
      ["cacheControl", "3600"],
    ]
      .map(([name, value]) => `${name} ${toBase64(value)}`)
      .join(",");
    const response = await fetch(endpoint, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: apiKey,
        "Tus-Resumable": TUS_VERSION,
        "Upload-Length": String(file.size),
        "Upload-Metadata": metadata,
        "x-upsert": "false",
      },
    });
    if (!response.ok) throw new Error(await storageError(response, "Could not start resumable upload."));
    location = response.headers.get("location");
    if (!location) throw new Error("Supabase did not return a resumable upload location.");
    if (location.startsWith("/")) location = `${new URL(supabaseUrl).origin}${location}`;
    window.localStorage.setItem(key, location);
    offset = Number(response.headers.get("upload-offset") || 0);
  }

  onProgress(file.size ? (offset / file.size) * 100 : 0);
  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);
    let lastError: unknown = null;
    for (const delay of [0, 1000, 3000, 5000]) {
      if (delay) await wait(delay, signal);
      try {
        const response = await fetch(location, {
          method: "PATCH",
          signal,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: apiKey,
            "Tus-Resumable": TUS_VERSION,
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
          },
          body: chunk,
        });
        if (!response.ok) throw new Error(await storageError(response, "Resumable upload chunk failed."));
        const nextOffset = Number(response.headers.get("upload-offset") || end);
        offset = Number.isFinite(nextOffset) && nextOffset >= end ? nextOffset : end;
        lastError = null;
        onProgress((offset / file.size) * 100);
        break;
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
        try {
          offset = await getOffset(location, session.access_token, apiKey, signal);
          if (offset >= end) {
            lastError = null;
            onProgress((offset / file.size) * 100);
            break;
          }
        } catch {
          // Retry with the current known offset.
        }
      }
    }
    if (lastError) throw lastError instanceof Error ? lastError : new Error("Resumable upload failed.");
  }
  window.localStorage.removeItem(key);
}

export async function sha256ForDuplicateCheck(file: File): Promise<string | null> {
  if (file.size > 64 * 1024 * 1024) return null;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function getOffset(location: string, token: string, apiKey: string, signal?: AbortSignal) {
  const response = await fetch(location, {
    method: "HEAD",
    signal,
    headers: { Authorization: `Bearer ${token}`, apikey: apiKey, "Tus-Resumable": TUS_VERSION },
  });
  if (!response.ok) throw new Error("Could not resume the previous upload session.");
  return Number(response.headers.get("upload-offset") || 0);
}

function readLocation(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

async function storageError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return payload.message || payload.error || fallback;
  } catch {
    return fallback;
  }
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Upload cancelled", "AbortError"));
    }, { once: true });
  });
}
