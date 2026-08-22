import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { resolveVideoObject, videoObjectMissingPayload } from "@/lib/videos/storage";
import { normalizeVideoMimeType } from "@/lib/videos/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid video identifier." }, { status: 400 });
  }

  const client = createAdminClient() ?? session;
  const { data: video, error } = await client
    .from("videos")
    .select("id,owner_id,file_path,filename,original_filename,mime_type,created_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!video?.file_path) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const resolved = await resolveVideoObject(client, video, user.id);
  if (!resolved) {
    return NextResponse.json(videoObjectMissingPayload(), { status: 410 });
  }

  const { data: signed, error: signedError } = await client.storage
    .from(resolved.bucket)
    .createSignedUrl(resolved.path, 900);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signedError?.message ?? "Could not create a temporary playback URL." },
      { status: 500 },
    );
  }

  try {
    const url = new URL(signed.signedUrl, process.env.NEXT_PUBLIC_SUPABASE_URL).toString();
    const filename = String(video.original_filename || `video-${id}.mp4`);
    return NextResponse.json(
      {
        url,
        filename,
        mimeType: normalizeVideoMimeType(String(video.mime_type || ""), filename),
        expiresIn: 900,
        storageRecovered: resolved.recovered,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json({ error: "The generated playback URL is invalid." }, { status: 500 });
  }
}
