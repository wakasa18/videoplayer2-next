import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number | null;
  retryAfterSeconds: number;
  available: boolean;
};

export async function consumeRateLimit(
  client: SupabaseClient,
  identity: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const normalizedLimit = Math.min(10000, Math.max(1, Math.floor(limit)));
  const normalizedWindow = Math.min(86400, Math.max(10, Math.floor(windowSeconds)));
  const bucketKey = createHash("sha256")
    .update(`phase10:${action}:${identity}`)
    .digest("hex");

  const { data, error } = await client.rpc("phase10_consume_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: normalizedLimit,
    p_window_seconds: normalizedWindow,
  });

  if (error) {
    // Fail open when Phase 10 SQL has not been applied, so an update cannot lock the owner out.
    return { allowed: true, remaining: null, retryAfterSeconds: 0, available: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const resetAt = new Date(String(row?.reset_at ?? ""));
  const retryAfterSeconds = Number.isNaN(resetAt.getTime())
    ? normalizedWindow
    : Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  return {
    allowed: Boolean(row?.allowed),
    remaining: Number.isFinite(Number(row?.remaining)) ? Number(row.remaining) : null,
    retryAfterSeconds,
    available: true,
  };
}

export function rateLimitValue(name: string, fallback: number): number {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
