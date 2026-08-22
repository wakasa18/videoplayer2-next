import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export class VideoRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function requireVideoWriteContext(request: Request): Promise<{
  client: SupabaseClient;
  user: User;
  accessMode: "service-role" | "session";
}> {
  assertSameOrigin(request);
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();
  if (error || !user) throw new VideoRequestError("Authentication required.", 401);
  const admin = createAdminClient();
  return {
    client: admin ?? sessionClient,
    user,
    accessMode: admin ? "service-role" : "session",
  };
}

export function getMaxVideoUploadBytes(): number {
  const raw = Number(process.env.VIDEOS_MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : 2 * 1024 * 1024 * 1024;
}

export function sanitizeText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().replace(/\0/g, "").slice(0, maxLength);
}

export function sanitizeFilename(value: unknown): string {
  const filename = String(value ?? "")
    .replace(/[\r\n\0]/g, "")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 240);
  if (!filename || filename === "." || filename === "..") {
    throw new VideoRequestError("Enter a valid video filename.");
  }
  return filename;
}

export function hashUploadToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function writeVideoAudit(
  client: SupabaseClient,
  ownerId: string,
  action: string,
  details: Record<string, unknown>,
  videoId: number | null = null,
): Promise<void> {
  try {
    await client.from("video_audits").insert({
      owner_id: ownerId,
      video_id: videoId,
      action: action.slice(0, 80),
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Audit logging is best-effort and must not block the primary action.
  }
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new VideoRequestError("Invalid request origin.", 403);
  }
  const expectedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (expectedHost && originHost !== expectedHost) {
    throw new VideoRequestError("Cross-site video actions are not allowed.", 403);
  }
}
