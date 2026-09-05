import { resolvePublicFile } from "@/lib/shares/data";
import { assertPublicShareRequestAccess, recordShareEvent, shareErrorResponse } from "@/lib/shares/server";
import { getFilesBucket } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PLAIN_TEXT_EXTENSIONS = new Set([
  "css",
  "html",
  "htm",
  "ini",
  "java",
  "js",
  "json",
  "log",
  "md",
  "php",
  "py",
  "sql",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  webm: "video/webm",
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  wma: "audio/x-ms-wma",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; fileId: string }> },
) {
  try {
    const { token, fileId: rawId } = await context.params;
    const fileId = Number.parseInt(rawId, 10);
    await assertPublicShareRequestAccess(token, request);
    const { admin, share, file } = await resolvePublicFile(token, fileId, false);
    const { data, error } = await admin.storage
      .from(getFilesBucket())
      .createSignedUrl(file.file_path, 300);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Could not create the preview URL.");
    }

    const upstreamHeaders = new Headers();
    const range = request.headers.get("range");
    const ifRange = request.headers.get("if-range");

    if (range) upstreamHeaders.set("Range", range);
    if (ifRange) upstreamHeaders.set("If-Range", ifRange);

    const upstream = await fetch(data.signedUrl, {
      cache: "no-store",
      headers: upstreamHeaders,
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error(`Could not load the preview file (${upstream.status}).`);
    }

    // Media elements may request the same preview in several byte ranges. Record
    // the initial request only so one video preview does not inflate analytics.
    if (!range || /^bytes=0-/i.test(range)) {
      await recordShareEvent(
        admin,
        share.id,
        "preview",
        request,
        { filename: file.original_filename },
        file.id,
      );
    }

    const contentType = getInlineContentType(file, upstream.headers);
    const safeName = sanitizeFilename(file.original_filename, file.id);
    const fallbackName = safeName
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_");
    const responseHeaders = new Headers({
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Content-Type": contentType,
      "Content-Security-Policy": "base-uri 'none'; frame-ancestors 'self'; object-src 'none'; form-action 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    });

    copyHeader(upstream.headers, responseHeaders, "accept-ranges");
    copyHeader(upstream.headers, responseHeaders, "content-length");
    copyHeader(upstream.headers, responseHeaders, "content-range");
    copyHeader(upstream.headers, responseHeaders, "etag");
    copyHeader(upstream.headers, responseHeaders, "last-modified");

    // Prevent active content in SVG previews when the preview URL is opened
    // directly in a browser tab.
    if (contentType.startsWith("image/svg+xml")) {
      responseHeaders.set(
        "Content-Security-Policy",
        "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; frame-ancestors 'self'",
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return shareErrorResponse(error);
  }
}

function getInlineContentType(
  file: { original_filename: string; mime_type: string },
  upstreamHeaders: Headers,
): string {
  const extension = getExtension(file.original_filename);

  // Code and HTML files must render as inert text, not as an executable
  // same-origin document inside the preview iframe.
  if (PLAIN_TEXT_EXTENSIONS.has(extension)) {
    return "text/plain; charset=utf-8";
  }

  const mapped = MIME_BY_EXTENSION[extension];
  if (mapped) return mapped;

  const storedMime = String(file.mime_type ?? "").trim().toLowerCase();
  if (
    storedMime === "application/pdf" ||
    storedMime.startsWith("image/") ||
    storedMime.startsWith("video/") ||
    storedMime.startsWith("audio/") ||
    storedMime.startsWith("text/")
  ) {
    return storedMime.startsWith("text/")
      ? "text/plain; charset=utf-8"
      : storedMime;
  }

  const upstreamType = upstreamHeaders.get("content-type")?.trim();
  return upstreamType && upstreamType !== "application/octet-stream"
    ? upstreamType
    : "application/octet-stream";
}

function sanitizeFilename(value: string, fileId: number): string {
  return value.replace(/[\r\n\0]/g, "").trim().slice(0, 240) || `file-${fileId}`;
}

function getExtension(filename: string): string {
  const clean = filename.trim();
  const index = clean.lastIndexOf(".");
  return index > -1 ? clean.slice(index + 1).toLowerCase() : "";
}

function copyHeader(source: Headers, target: Headers, name: string): void {
  const value = source.get(name);
  if (value) target.set(name, value);
}
