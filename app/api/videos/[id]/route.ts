import { NextResponse } from "next/server";

import { getVideosBucket } from "@/lib/supabase/admin";
import {
  requireVideoWriteContext,
  sanitizeFilename,
  sanitizeText,
  VideoRequestError,
  writeVideoAudit,
} from "@/lib/videos/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VideoPatchPayload =
  | { action: "metadata"; title?: unknown; originalName?: unknown; description?: unknown; category?: unknown }
  | { action: "favorite"; favorite?: unknown }
  | { action: "trash" }
  | { action: "restore" };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireVideoWriteContext(request);
    const payload = (await request.json()) as VideoPatchPayload;
    const { data: video, error } = await client
      .from("videos")
      .select("id,title,original_filename,status,is_favorite")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw new VideoRequestError(error.message, 422);
    if (!video) throw new VideoRequestError("Video not found.", 404);
    const now = new Date().toISOString();

    if (payload.action === "metadata") {
      if (video.status !== "active") throw new VideoRequestError("Restore this video before editing it.", 409);
      const title = sanitizeText(payload.title, 255);
      if (!title) throw new VideoRequestError("Enter a video title.");
      const originalName = sanitizeFilename(payload.originalName);
      const update = {
        title,
        original_filename: originalName,
        description: sanitizeText(payload.description, 5000) || null,
        category: sanitizeText(payload.category, 100) || null,
        updated_at: now,
      };
      const { error: updateError } = await client
        .from("videos")
        .update(update)
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "active");
      if (updateError) throw new VideoRequestError(updateError.message, 422);
      await writeVideoAudit(client, user.id, "video_metadata_updated", update, id);
      return NextResponse.json({ success: true, video: update });
    }

    if (payload.action === "favorite") {
      if (video.status !== "active") throw new VideoRequestError("Restore this video first.", 409);
      const favorite = Boolean(payload.favorite);
      const { error: updateError } = await client
        .from("videos")
        .update({ is_favorite: favorite, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "active");
      if (updateError) throw new VideoRequestError(updateError.message, 422);
      await writeVideoAudit(client, user.id, favorite ? "video_favorited" : "video_unfavorited", {}, id);
      return NextResponse.json({ success: true, favorite });
    }

    if (payload.action === "trash") {
      if (video.status !== "active") throw new VideoRequestError("Video is already in the Recycle Bin.", 409);
      const { error: updateError } = await client
        .from("videos")
        .update({ status: "deleted", deleted_at: now, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "active");
      if (updateError) throw new VideoRequestError(updateError.message, 422);
      await writeVideoAudit(client, user.id, "video_trashed", {}, id);
      return NextResponse.json({ success: true });
    }

    if (payload.action === "restore") {
      if (video.status !== "deleted") throw new VideoRequestError("Video is not in the Recycle Bin.", 409);
      const { error: updateError } = await client
        .from("videos")
        .update({ status: "active", deleted_at: null, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "deleted");
      if (updateError) throw new VideoRequestError(updateError.message, 422);
      await writeVideoAudit(client, user.id, "video_restored", {}, id);
      return NextResponse.json({ success: true });
    }

    throw new VideoRequestError("Unsupported video action.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireVideoWriteContext(request);
    const { data: video, error } = await client
      .from("videos")
      .select("id,file_path,thumbnail_path,status,original_filename")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw new VideoRequestError(error.message, 422);
    if (!video) throw new VideoRequestError("Video not found.", 404);
    if (video.status !== "deleted") {
      throw new VideoRequestError("Move the video to the Recycle Bin before permanent deletion.", 409);
    }

    const paths = [video.file_path, video.thumbnail_path].filter(Boolean).map(String);
    if (paths.length) {
      const { error: removeError } = await client.storage.from(getVideosBucket()).remove(paths);
      if (removeError) throw new VideoRequestError(removeError.message, 502);
    }
    const { error: deleteError } = await client
      .from("videos")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("status", "deleted");
    if (deleteError) throw new VideoRequestError(deleteError.message, 422);
    await writeVideoAudit(client, user.id, "video_permanently_deleted", {
      name: video.original_filename,
    }, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) throw new VideoRequestError("Invalid video identifier.");
  return id;
}

function errorResponse(error: unknown) {
  if (error instanceof VideoRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Could not update video." },
    { status: 500 },
  );
}
