import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

const LOGIN_WINDOW_MS = 10 * 60_000;
const LOCKOUT_MS = 10 * 60_000;
const MAX_FAILURES = 5;

export const APP_SESSION_COOKIE = "da_session_id";

export function normalizeLoginEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, 320);
}

export function securityHash(value: string): string {
  return createHash("sha256")
    .update(`${value}|${securitySalt()}`)
    .digest("hex");
}

export function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function deviceLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
      ? "Chrome"
      : ua.includes("firefox/")
        ? "Firefox"
        : ua.includes("safari/")
          ? "Safari"
          : "Browser";
  const platform = ua.includes("windows")
    ? "Windows"
    : ua.includes("iphone") || ua.includes("ipad")
      ? "iOS"
      : ua.includes("android")
        ? "Android"
        : ua.includes("mac os") || ua.includes("macintosh")
          ? "macOS"
          : ua.includes("linux")
            ? "Linux"
            : "Device";
  return `${browser} · ${platform}`;
}

export async function checkLoginLock(
  client: SupabaseClient,
  emailHash: string,
  ipHash: string,
): Promise<{ locked: boolean; retryAfterSeconds: number; bucketKey: string }> {
  const bucketKey = securityHash(`${emailHash}:${ipHash}`);
  const { data } = await client
    .from("workspace_login_attempts")
    .select("failure_count,window_started_at,locked_until")
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  const now = Date.now();
  const lockedUntil = data?.locked_until ? new Date(String(data.locked_until)).getTime() : 0;
  if (lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)),
      bucketKey,
    };
  }

  return { locked: false, retryAfterSeconds: 0, bucketKey };
}

export async function recordLoginFailure(
  client: SupabaseClient,
  input: {
    bucketKey: string;
    emailHash: string;
    ipHash: string;
    ownerId?: string | null;
    userAgent: string;
    reason: string;
  },
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const now = new Date();
  const { data: existing } = await client
    .from("workspace_login_attempts")
    .select("failure_count,window_started_at")
    .eq("bucket_key", input.bucketKey)
    .maybeSingle();

  const started = existing?.window_started_at
    ? new Date(String(existing.window_started_at)).getTime()
    : 0;
  const inWindow = started > 0 && now.getTime() - started < LOGIN_WINDOW_MS;
  const failureCount = inWindow ? Number(existing?.failure_count ?? 0) + 1 : 1;
  const locked = failureCount >= MAX_FAILURES;
  const lockedUntil = locked ? new Date(now.getTime() + LOCKOUT_MS).toISOString() : null;

  await client.from("workspace_login_attempts").upsert({
    bucket_key: input.bucketKey,
    email_hash: input.emailHash,
    ip_hash: input.ipHash,
    failure_count: failureCount,
    window_started_at: inWindow && existing?.window_started_at ? existing.window_started_at : now.toISOString(),
    locked_until: lockedUntil,
    last_attempt_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  await client.from("workspace_login_history").insert({
    owner_id: input.ownerId ?? null,
    email_hash: input.emailHash,
    ip_hash: input.ipHash,
    status: locked ? "locked" : "failed",
    reason: input.reason.slice(0, 160),
    user_agent: input.userAgent.slice(0, 1000),
    device_label: deviceLabel(input.userAgent),
    created_at: now.toISOString(),
  });

  return {
    locked,
    retryAfterSeconds: locked ? Math.ceil(LOCKOUT_MS / 1000) : 0,
  };
}

export async function recordLoginSuccess(
  client: SupabaseClient,
  request: Request,
  user: User,
  bucketKey: string,
  emailHash: string,
  ipHash: string,
): Promise<string> {
  const now = new Date().toISOString();
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const sessionId = randomUUID();

  await Promise.all([
    client.from("workspace_login_attempts").delete().eq("bucket_key", bucketKey),
    client
      .from("workspace_profiles")
      .update({ login_email_hash: emailHash, updated_at: now })
      .eq("owner_id", user.id),
    client.from("workspace_login_history").insert({
      owner_id: user.id,
      email_hash: emailHash,
      ip_hash: ipHash,
      status: "success",
      reason: "Password authentication succeeded",
      user_agent: userAgent.slice(0, 1000),
      device_label: deviceLabel(userAgent),
      created_at: now,
    }),
    client.from("workspace_sessions").insert({
      id: sessionId,
      owner_id: user.id,
      ip_hash: ipHash,
      user_agent: userAgent.slice(0, 1000),
      device_label: deviceLabel(userAgent),
      created_at: now,
      last_seen_at: now,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
    }),
  ]);

  return sessionId;
}

export async function findOwnerByEmailHash(
  client: SupabaseClient,
  emailHash: string,
): Promise<string | null> {
  const { data } = await client
    .from("workspace_profiles")
    .select("owner_id")
    .eq("login_email_hash", emailHash)
    .maybeSingle();
  return data?.owner_id ? String(data.owner_id) : null;
}

export async function markSessionRevoked(
  client: SupabaseClient,
  ownerId: string,
  sessionId: string,
  reason: string,
): Promise<void> {
  await client
    .from("workspace_sessions")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: reason.slice(0, 160) })
    .eq("id", sessionId)
    .eq("owner_id", ownerId);
}

export function requireSecurityAdmin(): SupabaseClient {
  const admin = createAdminClient();
  if (!admin) throw new Error("A server-only Supabase secret is required for security controls.");
  return admin;
}

function securitySalt(): string {
  return (
    process.env.SECURITY_EVENT_SALT ??
    process.env.SHARE_ANALYTICS_SALT ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "damons-archive-security"
  );
}
