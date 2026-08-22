import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { getVideosBucket } from "@/lib/supabase/admin";
import {
  getMaxVideoUploadBytes,
  hashUploadToken,
  requireVideoWriteContext,
  sanitizeFilename,
  sanitizeText,
  VideoRequestError,
  writeVideoAudit,
} from "@/lib/videos/server";
import {
  extensionFromFilename,
  isVideoMimeType,
  normalizeVideoMimeType,
  titleFromFilename,
} from "@/lib/videos/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PrepareVideoPayload = {
  originalName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  durationSeconds?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user, accessMode } = await requireVideoWriteContext(request);
    const payload = (await request.json()) as PrepareVideoPayload;
    const originalName = sanitizeFilename(payload.originalName);
    const fileSize = Number(payload.fileSize);
    const mimeType = normalizeVideoMimeType(
      sanitizeText(payload.mimeType, 150),
      originalName,
    );
    const maxBytes = getMaxVideoUploadBytes();

    if (!Number.isSafeInteger(fileSize) || fileSize < 1) {
      throw new VideoRequestError("Empty videos cannot be uploaded.");
    }
    if (fileSize > maxBytes) {
      throw new VideoRequestError(
        `This video is larger than the configured upload limit of ${formatBytes(maxBytes)}.`,
        413,
      );
    }
    if (!isVideoMimeType(mimeType, originalName)) {
      throw new VideoRequestError("Choose a supported video file.", 415);
    }

    const extension = extensionFromFilename(originalName);
    const storedFilename = `${randomBytes(20).toString("hex")}${extension ? `.${extension}` : ""}`;
    const now = new Date();
    const objectPath = `${user.id}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${storedFilename}`;
    const uploadToken = randomBytes(32).toString("hex");
    const uploadTokenHash = hashUploadToken(uploadToken);
    const duration = Number(payload.durationSeconds);
    const timestamp = now.toISOString();

    const { data: row, error: insertError } = await client
      .from("videos")
      .insert({
        owner_id: user.id,
        title: sanitizeText(payload.title, 255) || titleFromFilename(originalName),
        description: sanitizeText(payload.description, 5000) || null,
        category: sanitizeText(payload.category, 100) || null,
        filename: storedFilename,
        original_filename: originalName,
        file_path: objectPath,
        mime_type: mimeType,
        file_size: fileSize,
        duration_seconds:
          Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
        thumbnail_path: null,
        upload_token_hash: uploadTokenHash,
        status: "pending",
        is_favorite: false,
        view_count: 0,
        download_count: 0,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id")
      .single();

    if (insertError || !row?.id) {
      throw new VideoRequestError(
        insertError?.message ?? "Could not prepare the video upload.",
        422,
      );
    }

    const videoId = Number(row.id);
    const { data: signed, error: signedError } = await client.storage
      .from(getVideosBucket())
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (signedError || !signed?.signedUrl || !signed.token) {
      await client.from("videos").delete().eq("id", videoId).eq("owner_id", user.id);
      throw new VideoRequestError(
        signedError?.message ?? "Could not create a private video upload URL.",
        502,
      );
    }

    await writeVideoAudit(client, user.id, "upload_prepared", {
      video_id: videoId,
      name: originalName,
      size: fileSize,
      access_mode: accessMode,
    }, videoId);

    return NextResponse.json({
      videoId,
      uploadToken,
      signedUrl: signed.signedUrl,
      storageToken: signed.token,
      objectPath,
      maxUploadBytes: maxBytes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof VideoRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Could not prepare video upload." },
    { status: 500 },
  );
}

function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}
