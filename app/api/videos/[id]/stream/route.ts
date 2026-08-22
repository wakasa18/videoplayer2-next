import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { resolveVideoObject, videoObjectMissingPayload } from "@/lib/videos/storage";
import { normalizeVideoMimeType } from "@/lib/videos/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return proxyVideo(request, context, false);
}

export async function HEAD(request: Request, context: RouteContext) {
  return proxyVideo(request, context, true);
}

async function proxyVideo(request: Request, context: RouteContext, headOnly: boolean) {
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
    .select("id,owner_id,file_path,filename,original_filename,mime_type,file_size,view_count,created_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!video?.file_path) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const resolved = await resolveVideoObject(client, video, user.id);
  if (!resolved) {
    return NextResponse.json(videoObjectMissingPayload(), { status: 410 });
  }

  const { data: signed, error: signedError } = await client.storage
    .from(resolved.bucket)
    .createSignedUrl(resolved.path, 300);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signedError?.message ?? "Could not open video." },
      { status: 500 },
    );
  }

  let signedUrl: string;
  try {
    signedUrl = new URL(
      signed.signedUrl,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ).toString();
  } catch {
    return NextResponse.json({ error: "The generated video URL is invalid." }, { status: 500 });
  }

  const requestedRange = request.headers.get("range");
  const upstreamHeaders = new Headers({
    // Do not allow an intermediary to gzip a video while we preserve byte-range headers.
    "Accept-Encoding": "identity",
  });

  if (requestedRange) {
    upstreamHeaders.set("Range", requestedRange);
  } else if (headOnly) {
    // Some signed object endpoints do not accept HEAD. A one-byte GET gives us
    // reliable metadata while keeping HEAD responses body-free for the browser.
    upstreamHeaders.set("Range", "bytes=0-0");
  }

  const ifRange = request.headers.get("if-range");
  if (ifRange) upstreamHeaders.set("If-Range", ifRange);

  let upstream: Response;
  try {
    upstream = await fetch(signedUrl, {
      method: "GET",
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "follow",
      signal: request.signal,
    });
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error
            ? `Could not reach video storage: ${caught.message}`
            : "Could not reach video storage.",
      },
      { status: 502 },
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    const storageMessage = await readStorageError(upstream);
    return NextResponse.json(
      { error: storageMessage || `Video storage returned HTTP ${upstream.status}.` },
      { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
    );
  }

  const filename = String(video.original_filename || `video-${id}.mp4`);
  const contentType = normalizeVideoMimeType(
    upstream.headers.get("content-type") || String(resolved.info.contentType || video.mime_type || ""),
    filename,
  );
  const responseHeaders = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": inlineDisposition(filename),
    "Content-Type": contentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Accel-Buffering": "no",
    "X-Content-Type-Options": "nosniff",
    "X-Video-Proxy": "supabase-signed-object",
    "X-Video-Storage-Bucket": resolved.bucket,
    "X-Video-Upstream-Status": String(upstream.status),
  });

  const upstreamAcceptRanges = upstream.headers.get("accept-ranges");
  const upstreamContentRange = upstream.headers.get("content-range");
  if (upstreamAcceptRanges) responseHeaders.set("Accept-Ranges", upstreamAcceptRanges);
  else if (upstreamContentRange) responseHeaders.set("Accept-Ranges", "bytes");

  copyHeader(upstream.headers, responseHeaders, "etag");
  copyHeader(upstream.headers, responseHeaders, "last-modified");

  if (headOnly) {
    const total = totalFromContentRange(upstreamContentRange) ?? Number(video.file_size || 0);
    if (total > 0) responseHeaders.set("Content-Length", String(total));
    return new Response(null, { status: 200, headers: responseHeaders });
  }

  // Content-Length is safe only when the body was not content-encoded in transit.
  const contentEncoding = upstream.headers.get("content-encoding");
  if (!contentEncoding || contentEncoding === "identity") {
    copyHeader(upstream.headers, responseHeaders, "content-length");
  }
  if (upstreamContentRange) responseHeaders.set("Content-Range", upstreamContentRange);

  if (!requestedRange || /^bytes=0-/i.test(requestedRange)) {
    const now = new Date().toISOString();
    await client
      .from("videos")
      .update({
        view_count: Number(video.view_count ?? 0) + 1,
        last_viewed_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("owner_id", user.id);
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "Video storage returned an empty response." }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

function copyHeader(source: Headers, destination: Headers, name: string) {
  const value = source.get(name);
  if (value) destination.set(name, value);
}

function totalFromContentRange(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\/([0-9]+)$/);
  if (!match) return null;
  const total = Number.parseInt(match[1], 10);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function inlineDisposition(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 160) || "video";
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function readStorageError(response: Response): Promise<string> {
  try {
    const text = (await response.text()).slice(0, 500);
    if (!text) return "";
    const payload = JSON.parse(text) as { message?: string; error?: string };
    return payload.message || payload.error || text;
  } catch {
    return "";
  }
}
