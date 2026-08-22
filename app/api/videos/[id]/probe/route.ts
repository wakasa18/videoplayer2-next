import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { resolveVideoObject, videoObjectMissingPayload } from "@/lib/videos/storage";
import { normalizeVideoMimeType } from "@/lib/videos/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
type Sample = {
  bytes: Uint8Array;
  status: number;
  contentRange: string | null;
  contentType: string | null;
};

const SAMPLE_BYTES = 2 * 1024 * 1024;

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
    .select("id,owner_id,file_path,filename,original_filename,mime_type,file_size,created_at")
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
    .createSignedUrl(resolved.path, 300);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signedError?.message ?? "Could not inspect video storage." },
      { status: 500 },
    );
  }

  let signedUrl: string;
  try {
    signedUrl = new URL(signed.signedUrl, process.env.NEXT_PUBLIC_SUPABASE_URL).toString();
  } catch {
    return NextResponse.json({ error: "The generated video URL is invalid." }, { status: 500 });
  }

  const fileSize = Number(video.file_size || 0);
  let first: Sample;
  let tail: Sample | null = null;
  try {
    first = await fetchSample(signedUrl, 0, Math.max(0, SAMPLE_BYTES - 1));
    if (fileSize > SAMPLE_BYTES) {
      tail = await fetchSample(signedUrl, Math.max(0, fileSize - SAMPLE_BYTES), fileSize - 1);
    }
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error
            ? `Could not inspect the stored video: ${caught.message}`
            : "Could not inspect the stored video.",
      },
      { status: 502 },
    );
  }

  const firstText = ascii(first.bytes);
  const tailText = tail ? ascii(tail.bytes) : "";
  const analysis = analyzeVideo(first.bytes, firstText, tailText);
  const filename = String(video.original_filename || `video-${id}.mp4`);

  return NextResponse.json(
    {
      filename,
      storedMimeType: String(video.mime_type || ""),
      normalizedMimeType: normalizeVideoMimeType(String(video.mime_type || ""), filename),
      fileSize,
      storageContentType: first.contentType,
      storageBucket: resolved.bucket,
      storagePathRecovered: resolved.recovered,
      firstRequestStatus: first.status,
      tailRequestStatus: tail?.status ?? null,
      rangeSupported: Boolean(first.contentRange || tail?.contentRange),
      sampledBytes: first.bytes.byteLength + (tail?.bytes.byteLength ?? 0),
      ...analysis,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

async function fetchSample(url: string, start: number, end: number): Promise<Sample> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Range: `bytes=${start}-${end}`,
      "Accept-Encoding": "identity",
    },
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`storage returned HTTP ${response.status}`);
  }

  return {
    bytes: await readLimited(response, SAMPLE_BYTES),
    status: response.status,
    contentRange: response.headers.get("content-range"),
    contentType: response.headers.get("content-type"),
  };
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const remaining = limit - total;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function analyzeVideo(first: Uint8Array, firstText: string, tailText: string) {
  const combined = `${firstText}\n${tailText}`;
  const container = detectContainer(first, combined);
  const videoCodec = detectVideoCodec(combined);
  const audioCodec = detectAudioCodec(combined);
  const moovAtStart = mp4FastStart(firstText, tailText);
  const assessment = assess(container, videoCodec);

  return {
    container,
    videoCodec,
    audioCodec,
    mp4FastStart: moovAtStart,
    assessment: assessment.level,
    message: assessment.message,
  };
}

function detectContainer(first: Uint8Array, text: string): string {
  if (first.length >= 12 && ascii(first.slice(4, 8)) === "ftyp") return "mp4";
  if (first.length >= 12 && ascii(first.slice(0, 4)) === "RIFF" && ascii(first.slice(8, 12)) === "AVI ") return "avi";
  if (first.length >= 4 && ascii(first.slice(0, 4)) === "OggS") return "ogg";
  if (first.length >= 4 && first[0] === 0x1a && first[1] === 0x45 && first[2] === 0xdf && first[3] === 0xa3) {
    return text.toLowerCase().includes("webm") ? "webm" : "matroska";
  }
  if (text.trimStart().startsWith("{") || text.trimStart().startsWith("<")) return "not-video-response";
  return "unknown";
}

function detectVideoCodec(text: string): string {
  if (hasAny(text, ["hvc1", "hev1"])) return "hevc-h265";
  if (hasAny(text, ["avc1", "avc3"])) return "avc-h264";
  if (text.includes("av01")) return "av1";
  if (text.includes("vp09")) return "vp9";
  if (text.includes("vp08")) return "vp8";
  if (text.includes("theora")) return "theora";
  return "unknown";
}

function detectAudioCodec(text: string): string {
  if (text.includes("mp4a")) return "aac-or-mpeg4-audio";
  if (text.includes("OpusHead")) return "opus";
  if (text.toLowerCase().includes("vorbis")) return "vorbis";
  if (text.includes("ec-3")) return "eac3";
  if (text.includes("ac-3")) return "ac3";
  return "unknown";
}

function mp4FastStart(firstText: string, tailText: string): boolean | null {
  const moov = firstText.indexOf("moov");
  const mdat = firstText.indexOf("mdat");
  if (moov >= 0 && mdat >= 0) return moov < mdat;
  if (moov >= 0) return true;
  if (tailText.includes("moov") && firstText.includes("mdat")) return false;
  return null;
}

function assess(container: string, videoCodec: string) {
  if (container === "not-video-response") {
    return {
      level: "invalid-response",
      message: "The stored object returned text or HTML instead of video bytes.",
    };
  }
  if (container === "unknown") {
    return {
      level: "invalid-or-damaged",
      message: "The stored object does not have a recognized video-container signature.",
    };
  }
  if (videoCodec === "hevc-h265") {
    return {
      level: "limited-browser-support",
      message: "The file uses HEVC/H.265. Many Chrome and Windows installations cannot decode this codec even though the filename ends in .mp4.",
    };
  }
  if (videoCodec === "avc-h264") {
    return {
      level: "normally-compatible",
      message: "H.264 video was detected. If both playback paths fail, the upload may be incomplete or the MP4 index may be damaged.",
    };
  }
  if (["av1", "vp9", "vp8"].includes(videoCodec)) {
    return {
      level: "modern-codec",
      message: `The file uses ${videoCodec.toUpperCase()}. Playback depends on browser and device codec support.`,
    };
  }
  return {
    level: "unknown-codec",
    message: "A video container was detected, but the video codec could not be identified from the sampled metadata.",
  };
}

function hasAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function ascii(bytes: Uint8Array): string {
  let result = "";
  const chunkSize = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, Math.min(bytes.length, offset + chunkSize));
    result += String.fromCharCode(...chunk);
  }
  return result;
}
