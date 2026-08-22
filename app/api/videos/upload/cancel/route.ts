import { NextResponse } from "next/server";

import { getVideosBucket } from "@/lib/supabase/admin";
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
    const token = String(payload.uploadToken ?? "").trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new VideoRequestError("Invalid upload token.");

    const { data: video, error } = await client
      .from("videos")
      .select("id,file_path,original_filename")
      .eq("owner_id", user.id)
      .eq("upload_token_hash", hashUploadToken(token))
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw new VideoRequestError(error.message, 422);
    if (!video?.id) return NextResponse.json({ success: true });

    if (video.file_path) {
      await client.storage.from(getVideosBucket()).remove([String(video.file_path)]);
    }
    await client.from("videos").delete().eq("id", video.id).eq("owner_id", user.id);
    await writeVideoAudit(client, user.id, "upload_cancelled", {
      name: video.original_filename,
    }, Number(video.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof VideoRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cancel video upload." },
      { status: 500 },
    );
  }
}
