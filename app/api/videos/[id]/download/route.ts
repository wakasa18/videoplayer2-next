import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { resolveVideoObject, videoObjectMissingPayload } from "@/lib/videos/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid video identifier." }, { status: 400 });
  }
  const client = createAdminClient() ?? session;
  const { data: video, error } = await client
    .from("videos")
    .select("id,owner_id,file_path,filename,original_filename,download_count,created_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!video?.file_path) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const resolved = await resolveVideoObject(client, video, user.id);
  if (!resolved) {
    return NextResponse.json(videoObjectMissingPayload(), { status: 410 });
  }

  const safeName = String(video.original_filename || `video-${id}.mp4`)
    .replace(/[\r\n\0]/g, "")
    .slice(0, 240);
  const { data: signed, error: signedError } = await client.storage
    .from(resolved.bucket)
    .createSignedUrl(resolved.path, 300, { download: safeName });
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? "Could not download video." }, { status: 500 });
  }

  await client
    .from("videos")
    .update({
      download_count: Number(video.download_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  return NextResponse.redirect(signed.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
