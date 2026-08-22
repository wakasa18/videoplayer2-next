import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getFilesBucket, getVideosBucket } from "@/lib/supabase/admin";

export const VIDEO_OBJECT_MISSING = "VIDEO_OBJECT_MISSING";

export type VideoStorageRecord = {
  id?: number;
  owner_id?: string;
  file_path?: string | null;
  filename?: string | null;
  original_filename?: string | null;
  created_at?: string | null;
};

export type ResolvedVideoObject = {
  bucket: string;
  path: string;
  info: {
    size?: number | null;
    contentType?: string | null;
    [key: string]: unknown;
  };
  recovered: boolean;
};

/**
 * Resolves both current Phase 6 paths and common legacy/migration path shapes.
 * Supabase can create a signed URL for a missing object, so every playback route
 * must verify the object first instead of treating createSignedUrl as proof that
 * the file exists.
 */
export async function resolveVideoObject(
  client: SupabaseClient,
  video: VideoStorageRecord,
  ownerId: string,
): Promise<ResolvedVideoObject | null> {
  const configuredBucket = getVideosBucket();
  const buckets = unique([configuredBucket, "videos", getFilesBucket()]);

  for (const bucket of buckets) {
    const candidates = buildCandidatePaths(video, ownerId, bucket);
    const found = await findObjectInBucket(client, bucket, candidates);
    if (found) {
      const recovered =
        bucket !== configuredBucket ||
        normalizeStoragePath(String(video.file_path ?? ""), configuredBucket) !== found.path;

      // Persist a corrected path only when the object is in the configured
      // videos bucket. Alternate-bucket recovery stays read-only because the
      // videos table does not contain a bucket column.
      if (recovered && bucket === configuredBucket && video.id) {
        try {
          await client
            .from("videos")
            .update({ file_path: found.path, updated_at: new Date().toISOString() })
            .eq("id", video.id)
            .eq("owner_id", ownerId);
        } catch {
          // Playback can still continue even if the legacy path cannot be persisted.
        }
      }

      return {
        bucket,
        path: found.path,
        info: found.info,
        recovered,
      };
    }
  }

  return null;
}

export function videoObjectMissingPayload() {
  return {
    error:
      "The video record exists, but its file is missing from Supabase Storage. Select the original video to restore this record.",
    code: VIDEO_OBJECT_MISSING,
    canRepair: true,
  };
}

export function normalizeStoragePath(rawValue: string, bucket: string): string {
  let value = String(rawValue ?? "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    value = decodeURIComponent(url.pathname);
  } catch {
    value = value.split(/[?#]/, 1)[0] ?? value;
  }

  value = value.replace(/\\/g, "/");
  const storageMarkers = [
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/object/${bucket}/`,
    `/object/sign/${bucket}/`,
    `/object/public/${bucket}/`,
    `/object/authenticated/${bucket}/`,
    `/object/${bucket}/`,
  ];

  for (const marker of storageMarkers) {
    const index = value.indexOf(marker);
    if (index >= 0) {
      value = value.slice(index + marker.length);
      break;
    }
  }

  value = value.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (value.toLowerCase().startsWith(`${bucket.toLowerCase()}/`)) {
    value = value.slice(bucket.length + 1);
  }
  return safeObjectPath(value);
}

function buildCandidatePaths(
  video: VideoStorageRecord,
  ownerId: string,
  bucket: string,
): string[] {
  const rawPath = normalizeStoragePath(String(video.file_path ?? ""), bucket);
  const storedName = safeFilename(String(video.filename ?? ""));
  const originalName = safeFilename(String(video.original_filename ?? ""));
  const date = parseDate(video.created_at);
  const datedPrefix = date
    ? `${ownerId}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    : "";
  const rawDirectory = rawPath.includes("/") ? rawPath.slice(0, rawPath.lastIndexOf("/")) : "";

  const uploadsSuffix = suffixFrom(rawPath, "uploads/");
  const videosSuffix = suffixFrom(rawPath, "videos/");

  return unique([
    rawPath,
    uploadsSuffix,
    videosSuffix,
    rawDirectory && storedName ? `${rawDirectory}/${storedName}` : "",
    rawDirectory && originalName ? `${rawDirectory}/${originalName}` : "",
    datedPrefix && storedName ? `${datedPrefix}/${storedName}` : "",
    datedPrefix && originalName ? `${datedPrefix}/${originalName}` : "",
    storedName ? `${ownerId}/${storedName}` : "",
    originalName ? `${ownerId}/${originalName}` : "",
    storedName ? `${ownerId}/videos/${storedName}` : "",
    originalName ? `${ownerId}/videos/${originalName}` : "",
    storedName ? `videos/${storedName}` : "",
    originalName ? `videos/${originalName}` : "",
    storedName,
    originalName,
  ]).map(safeObjectPath).filter(Boolean);
}

async function findObjectInBucket(
  client: SupabaseClient,
  bucket: string,
  candidates: string[],
): Promise<{ path: string; info: ResolvedVideoObject["info"] } | null> {
  if (!candidates.length) return null;
  const storage = client.storage.from(bucket);

  // The canonical path is by far the common case, so avoid issuing fallback
  // requests unless that exact lookup fails.
  const [first, ...fallbacks] = candidates;
  const primary = await storage.info(first);
  if (!primary.error && primary.data) {
    return { path: first, info: primary.data as ResolvedVideoObject["info"] };
  }

  const results = await Promise.all(
    fallbacks.map(async (path) => {
      const result = await storage.info(path);
      return !result.error && result.data
        ? { path, info: result.data as ResolvedVideoObject["info"] }
        : null;
    }),
  );
  return results.find(Boolean) ?? null;
}

function suffixFrom(path: string, marker: string): string {
  const index = path.toLowerCase().indexOf(marker.toLowerCase());
  return index >= 0 ? path.slice(index) : "";
}

function safeObjectPath(value: string): string {
  return value
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .slice(0, 1024);
}

function safeFilename(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  return (normalized.split("/").pop() ?? "")
    .replace(/[\r\n\0]/g, "")
    .trim()
    .slice(0, 240);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
