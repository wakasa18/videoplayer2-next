import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { getVideosBucket } from "@/lib/supabase/admin";
import {
  createVideoRepairToken,
  verifyVideoRepairToken,
} from "@/lib/videos/repair-token";
import {
  getMaxVideoUploadBytes,
  requireVideoWriteContext,
  sanitizeFilename,
  sanitizeText,
  VideoRequestError,
  writeVideoAudit,
} from "@/lib/videos/server";
import { resolveVideoObject } from "@/lib/videos/storage";
import {
  extensionFromFilename,
  isVideoMimeType,
  normalizeVideoMimeType,
} from "@/lib/videos/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
type RepairPayload = {
  originalName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
  durationSeconds?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireVideoWriteContext(request);
    const payload = (await request.json()) as RepairPayload;
    const originalName = sanitizeFilename(payload.originalName);
    const fileSize = Number(payload.fileSize);
    const mimeType = normalizeVideoMimeType(
      sanitizeText(payload.mimeType, 150),
      originalName,
    );
    const duration = Number(payload.durationSeconds);

    if (!Number.isSafeInteger(fileSize) || fileSize < 1) {
      throw new VideoRequestError("Choose a non-empty video file.");
    }
    if (fileSize > getMaxVideoUploadBytes()) {
      throw new VideoRequestError("The replacement video exceeds the configured upload limit.", 413);
    }
    if (!isVideoMimeType(mimeType, originalName)) {
      throw new VideoRequestError("Choose a supported video file.", 415);
    }

    const { data: video, error } = await client
      .from("videos")
      .select("id,owner_id,file_path,filename,original_filename,created_at,status")
      .eq("id", id)
      .eq("owner_id", user.id)
      .in("status", ["active", "failed", "deleted"])
      .maybeSingle();
    if (error) throw new VideoRequestError(error.message, 422);
    if (!video) throw new VideoRequestError("Video record not found.", 404);

    const existingObject = await resolveVideoObject(client, video, user.id);
    if (existingObject) {
      throw new VideoRequestError(
        "The stored video file is available. Refresh the page before trying to restore it.",
        409,
      );
    }

    const extension = extensionFromFilename(originalName);
    const storedFilename = `${randomBytes(20).toString("hex")}${extension ? `.${extension}` : ""}`;
    const now = new Date();
    const objectPath = `${user.id}/${now.getUTCFullYear()}/${String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0")}/${storedFilename}`;

    const { data: signed, error: signedError } = await client.storage
      .from(getVideosBucket())
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (signedError || !signed?.signedUrl || !signed.token) {
      throw new VideoRequestError(
        signedError?.message ?? "Could not prepare the replacement upload.",
        502,
      );
    }

    const repairToken = createVideoRepairToken({
      videoId: id,
      ownerId: user.id,
      objectPath,
      storedFilename,
      originalFilename: originalName,
      mimeType,
      fileSize,
      durationSeconds:
        Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
    });

    await writeVideoAudit(
      client,
      user.id,
      "video_restore_prepared",
      { name: originalName, size: fileSize },
      id,
    );

    return NextResponse.json({
      repairToken,
      signedUrl: signed.signedUrl,
      storageToken: signed.token,
      objectPath,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireVideoWriteContext(request);
    const payload = (await request.json()) as { repairToken?: unknown };
    const claims = verifyVideoRepairToken(String(payload.repairToken ?? "").trim());
    assertClaims(claims.videoId, claims.ownerId, id, user.id);

    const { data: video, error } = await client
      .from("videos")
      .select("id,owner_id,file_path,filename,original_filename,created_at,status")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw new VideoRequestError(error.message, 422);
    if (!video) throw new VideoRequestError("Video record not found.", 404);

    const storage = client.storage.from(getVideosBucket());
    const { data: info, error: infoError } = await storage.info(claims.objectPath);
    if (infoError || !info) {
      throw new VideoRequestError(
        infoError?.message ?? "The replacement upload was not found in storage.",
        422,
      );
    }
    const actualSize = Number(info.size ?? 0);
    if (actualSize !== claims.fileSize) {
      await storage.remove([claims.objectPath]);
      throw new VideoRequestError("The replacement upload was incomplete or had the wrong size.", 422);
    }

    const previous = await resolveVideoObject(client, video, user.id);
    const timestamp = new Date().toISOString();
    const { error: updateError } = await client
      .from("videos")
      .update({
        filename: claims.storedFilename,
        original_filename: claims.originalFilename,
        file_path: claims.objectPath,
        mime_type: normalizeVideoMimeType(
          String(info.contentType ?? claims.mimeType),
          claims.originalFilename,
        ).slice(0, 150),
        file_size: actualSize,
        duration_seconds: claims.durationSeconds,
        upload_token_hash: null,
        status: "active",
        deleted_at: null,
        finalized_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (updateError) {
      await storage.remove([claims.objectPath]);
      throw new VideoRequestError(updateError.message, 422);
    }

    if (
      previous &&
      previous.bucket === getVideosBucket() &&
      previous.path !== claims.objectPath
    ) {
      await client.storage.from(previous.bucket).remove([previous.path]);
    }

    await writeVideoAudit(
      client,
      user.id,
      "video_file_restored",
      {
        name: claims.originalFilename,
        size: actualSize,
        previous_object_found: Boolean(previous),
      },
      id,
    );

    return NextResponse.json({ success: true, videoId: id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireVideoWriteContext(request);
    const payload = (await request.json()) as { repairToken?: unknown };
    const claims = verifyVideoRepairToken(String(payload.repairToken ?? "").trim());
    assertClaims(claims.videoId, claims.ownerId, id, user.id);
    await client.storage.from(getVideosBucket()).remove([claims.objectPath]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function assertClaims(tokenVideoId: number, tokenOwnerId: string, id: number, ownerId: string) {
  if (tokenVideoId !== id || tokenOwnerId !== ownerId) {
    throw new VideoRequestError("The restore token does not belong to this video.", 403);
  }
}

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new VideoRequestError("Invalid video identifier.");
  }
  return id;
}

function errorResponse(error: unknown) {
  if (error instanceof VideoRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Could not restore the video file." },
    { status: 500 },
  );
}
