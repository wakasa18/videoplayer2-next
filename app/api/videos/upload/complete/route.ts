import { NextResponse } from "next/server";

import { getVideosBucket } from "@/lib/supabase/admin";
import { normalizeVideoMimeType } from "@/lib/videos/utils";
import {
  hashUploadToken,
  requireVideoWriteContext,
  VideoRequestError,
  writeVideoAudit,
} from "@/lib/videos/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { client, user } = await requireVideoWriteContext(request);
    const payload = (await request.json()) as { uploadToken?: unknown };
    const uploadToken = String(payload.uploadToken ?? "").trim();
    if (!/^[a-f0-9]{64}$/.test(uploadToken)) {
      throw new VideoRequestError("The video upload token is invalid.");
    }

    const { data: video, error } = await client
      .from("videos")
      .select("id,file_path,file_size,mime_type,original_filename")
      .eq("owner_id", user.id)
      .eq("upload_token_hash", hashUploadToken(uploadToken))
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw new VideoRequestError(error.message, 422);
    if (!video?.id || !video.file_path) {
      throw new VideoRequestError("This upload expired or was already finalized.", 409);
    }

    const videoId = Number(video.id);
    const storage = client.storage.from(getVideosBucket());
    const { data: info, error: infoError } = await storage.info(String(video.file_path));
    if (infoError || !info) {
      await failUpload(client, user.id, videoId, String(video.file_path));
      throw new VideoRequestError(infoError?.message ?? "Uploaded video was not found.", 422);
    }

    const actualSize = Number(info.size ?? 0);
    if (actualSize !== Number(video.file_size ?? 0)) {
      await failUpload(client, user.id, videoId, String(video.file_path));
      throw new VideoRequestError("The uploaded video size did not match the prepared upload.", 422);
    }

    const timestamp = new Date().toISOString();
    const { error: updateError } = await client
      .from("videos")
      .update({
        status: "active",
        mime_type: normalizeVideoMimeType(
          String(info.contentType ?? video.mime_type ?? ""),
          String(video.original_filename ?? ""),
        ).slice(0, 150),
        upload_token_hash: null,
        finalized_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", videoId)
      .eq("owner_id", user.id)
      .eq("status", "pending");
    if (updateError) {
      await failUpload(client, user.id, videoId, String(video.file_path));
      throw new VideoRequestError(updateError.message, 422);
    }

    await writeVideoAudit(client, user.id, "video_uploaded", {
      name: video.original_filename,
      size: actualSize,
    }, videoId);

    return NextResponse.json({ success: true, videoId });
  } catch (error) {
    return errorResponse(error);
  }
}

async function failUpload(
  client: Awaited<ReturnType<typeof requireVideoWriteContext>>["client"],
  ownerId: string,
  videoId: number,
  path: string,
) {
  await client.storage.from(getVideosBucket()).remove([path]);
  await client
    .from("videos")
    .update({ status: "failed", upload_token_hash: null, updated_at: new Date().toISOString() })
    .eq("id", videoId)
    .eq("owner_id", ownerId);
}

function errorResponse(error: unknown) {
  if (error instanceof VideoRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Could not finalize video upload." },
    { status: 500 },
  );
}
