import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeFolderPath } from "@/lib/files/utils";
import type { ImportantFileShare } from "@/lib/shares/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export class ShareRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ShareRequestError";
    this.status = status;
  }
}

export type ShareOwnerContext = {
  client: SupabaseClient;
  user: User;
};

export async function requireShareOwnerContext(
  request: Request,
): Promise<ShareOwnerContext> {
  assertSameOrigin(request);
  const session = await createSessionClient();
  const {
    data: { user },
    error,
  } = await session.auth.getUser();

  if (error || !user) {
    throw new ShareRequestError("Authentication required.", 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    throw new ShareRequestError(
      "SUPABASE_SERVICE_ROLE_KEY is required for private share management.",
      500,
    );
  }

  return { client: admin, user };
}

export function requirePublicAdminClient(): SupabaseClient {
  const admin = createAdminClient();
  if (!admin) {
    throw new ShareRequestError(
      "Public sharing is not configured. Add SUPABASE_SERVICE_ROLE_KEY.",
      500,
    );
  }
  return admin;
}

export function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenHashMatch(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashShareToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptShareToken(token: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((value) => value.toString("base64url")).join(".");
}

export function decryptShareToken(value: string | null): string | null {
  if (!value) return null;
  try {
    const [ivPart, tagPart, cipherPart] = value.split(".");
    if (!ivPart || !tagPart || !cipherPart) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function sanitizeShareTitle(value: unknown): string | null {
  const text = String(value ?? "").trim().slice(0, 255);
  return text || null;
}

export function sanitizeShareMessage(value: unknown): string | null {
  const text = String(value ?? "").trim().slice(0, 5000);
  return text || null;
}

export function sanitizeDisplayName(value: unknown): string | null {
  const text = String(value ?? "").trim().slice(0, 100);
  return text || null;
}

export function sanitizeExpiry(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ShareRequestError("The expiration date is invalid.");
  }
  if (date.getTime() <= Date.now() + 60_000) {
    throw new ShareRequestError("The expiration must be in the future.");
  }
  return date.toISOString();
}

export function sanitizeMaxDownloads(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const count = Number.parseInt(String(value), 10);
  if (!Number.isInteger(count) || count < 1 || count > 100000) {
    throw new ShareRequestError(
      "Maximum downloads must be between 1 and 100,000.",
    );
  }
  return count;
}

export function getShareState(
  share: Pick<
    ImportantFileShare,
    "revoked_at" | "expires_at" | "max_downloads" | "download_count"
  >,
): "active" | "expired" | "limit-reached" | "revoked" {
  if (share.revoked_at) return "revoked";
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return "expired";
  }
  if (
    share.max_downloads !== null &&
    share.download_count >= share.max_downloads
  ) {
    return "limit-reached";
  }
  return "active";
}

export function assertShareCanOpen(share: ImportantFileShare): void {
  const state = getShareState(share);
  if (state === "revoked") {
    throw new ShareRequestError("This shared link has been revoked.", 410);
  }
  if (state === "expired") {
    throw new ShareRequestError("This shared link has expired.", 410);
  }
}

export function assertShareCanDownload(share: ImportantFileShare): void {
  assertShareCanOpen(share);
  if (!share.allow_downloads) {
    throw new ShareRequestError("Downloads are disabled for this shared link.", 403);
  }
  if (
    share.max_downloads !== null &&
    share.download_count >= share.max_downloads
  ) {
    throw new ShareRequestError("This shared link reached its download limit.", 410);
  }
}

export function buildPublicShareUrl(request: Request, token: string): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return `${explicit}/share/${encodeURIComponent(token)}`;

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!forwardedHost) {
    return `/share/${encodeURIComponent(token)}`;
  }
  return `${forwardedProto}://${forwardedHost}/share/${encodeURIComponent(token)}`;
}

export function normalizeShareFolderPath(value: unknown): string {
  const path = normalizeFolderPath(String(value ?? ""));
  if (!path || path.length > 1000) {
    throw new ShareRequestError("Select a valid folder to share.");
  }
  return path;
}

export function normalizeRelativePublicPath(
  root: string,
  requested: unknown,
): string {
  const rootPath = normalizeFolderPath(root);
  const relative = normalizeFolderPath(String(requested ?? ""));
  if (!relative) return rootPath;
  const candidate = relative.startsWith(`${rootPath}/`) || relative === rootPath
    ? relative
    : normalizeFolderPath(`${rootPath}/${relative}`);
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}/`)) {
    throw new ShareRequestError("Invalid shared folder path.", 400);
  }
  return candidate;
}

export function requestSessionHash(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256")
    .update(`${ip}|${ua}|${getSessionSalt()}`)
    .digest("hex");
}

export async function recordShareEvent(
  client: SupabaseClient,
  shareId: number,
  eventType: string,
  request: Request,
  details: Record<string, unknown> = {},
  fileId: number | null = null,
): Promise<void> {
  try {
    await client.from("important_file_share_events").insert({
      share_id: shareId,
      file_id: fileId,
      event_type: eventType.slice(0, 60),
      session_hash: requestSessionHash(request),
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Analytics is best-effort and never blocks public access.
  }
}

export function shareErrorResponse(error: unknown): Response {
  if (error instanceof ShareRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    {
      error:
        error instanceof Error ? error.message : "The sharing action failed.",
    },
    { status: 500 },
  );
}

function getEncryptionKey(): Buffer {
  const material =
    process.env.SHARE_TOKEN_ENCRYPTION_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY;
  if (!material) {
    throw new ShareRequestError(
      "Configure SHARE_TOKEN_ENCRYPTION_KEY or a server-only Supabase secret.",
      500,
    );
  }
  return createHash("sha256").update(material).digest();
}

function getSessionSalt(): string {
  return (
    process.env.SHARE_ANALYTICS_SALT ??
    process.env.SHARE_TOKEN_ENCRYPTION_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "share-analytics"
  );
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ShareRequestError("Invalid request origin.", 403);
  }
  const expectedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (expectedHost && originHost !== expectedHost) {
    throw new ShareRequestError("Cross-site share actions are not allowed.", 403);
  }
}


export function sanitizeSharePassword(value: unknown): string | null {
  const password = String(value ?? "").trim();
  if (!password) return null;
  if (password.length < 6 || password.length > 128) {
    throw new ShareRequestError("Share passwords must be 6 to 128 characters.");
  }
  return password;
}

export function sanitizePasswordHint(value: unknown): string | null {
  const hint = String(value ?? "").trim().slice(0, 120);
  return hint || null;
}

export function createSharePasswordHash(password: string | null): { passwordHash: string | null; passwordSalt: string | null } {
  if (!password) return { passwordHash: null, passwordSalt: null };
  const salt = randomBytes(16).toString("hex");
  return { passwordHash: scryptSync(password, salt, 64).toString("hex"), passwordSalt: salt };
}

export function verifySharePassword(password: string, hash: string | null, salt: string | null): boolean {
  if (!hash || !salt) return true;
  try {
    const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
    const expected = Buffer.from(hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function shareAccessCookieName(token: string): string {
  return `da_share_${hashShareToken(token).slice(0, 16)}`;
}

export function shareAccessCookieValue(token: string, passwordHash: string): string {
  return createHmac("sha256", getSessionSalt()).update(`${hashShareToken(token)}|${passwordHash}`).digest("hex");
}

type PublicSharePasswordGate = { required: boolean; unlocked: boolean; hint: string | null };

async function resolvePublicSharePasswordGate(
  token: string,
  cookieValue: string | null,
): Promise<PublicSharePasswordGate> {
  const clean = String(token ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(clean)) {
    throw new ShareRequestError("Invalid shared link.", 404);
  }

  const admin = requirePublicAdminClient();
  const { data, error } = await admin
    .from("important_file_shares")
    .select("password_hash,password_hint,revoked_at,expires_at")
    .eq("token_hash", hashShareToken(clean))
    .maybeSingle();

  if (error) throw new ShareRequestError(error.message, 500);
  if (!data) throw new ShareRequestError("Shared link not found.", 404);
  if (data.revoked_at) throw new ShareRequestError("This shared link has been revoked.", 410);
  if (data.expires_at && new Date(String(data.expires_at)).getTime() <= Date.now()) {
    throw new ShareRequestError("This shared link has expired.", 410);
  }

  const passwordHash = data.password_hash ? String(data.password_hash) : null;
  if (!passwordHash) return { required: false, unlocked: true, hint: null };

  const expected = shareAccessCookieValue(clean, passwordHash);
  const unlocked = cookieValue ? safeStringEqual(cookieValue, expected) : false;
  return {
    required: true,
    unlocked,
    hint: data.password_hint ? String(data.password_hint) : null,
  };
}

export async function getPublicSharePasswordGate(
  token: string,
  request: Request,
): Promise<PublicSharePasswordGate> {
  const clean = String(token ?? "").trim();
  const cookie = readCookie(
    request.headers.get("cookie") ?? "",
    shareAccessCookieName(clean),
  );
  return resolvePublicSharePasswordGate(clean, cookie);
}

export async function getPublicSharePasswordGateFromCookie(
  token: string,
  cookieValue: string | null,
): Promise<PublicSharePasswordGate> {
  return resolvePublicSharePasswordGate(token, cookieValue);
}

export async function assertPublicShareRequestAccess(token: string, request: Request): Promise<void> {
  const gate = await getPublicSharePasswordGate(token, request);
  if (gate.required && !gate.unlocked) throw new ShareRequestError("Enter the shared-link password to continue.", 401);
}

export async function verifyPublicSharePassword(token: string, password: string): Promise<{ cookieName: string; cookieValue: string }> {
  const admin = requirePublicAdminClient();
  const { data, error } = await admin
    .from("important_file_shares")
    .select("password_hash,password_salt")
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();
  if (error) throw new ShareRequestError(error.message, 500);
  if (!data?.password_hash || !data.password_salt) throw new ShareRequestError("This shared link does not require a password.", 400);
  if (!verifySharePassword(password, String(data.password_hash), String(data.password_salt))) throw new ShareRequestError("Incorrect shared-link password.", 401);
  return { cookieName: shareAccessCookieName(token), cookieValue: shareAccessCookieValue(token, String(data.password_hash)) };
}

function readCookie(header: string, name: string): string | null {
  const pair = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function safeStringEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
