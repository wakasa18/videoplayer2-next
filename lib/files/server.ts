import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeFolderPath } from "@/lib/files/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const DEFAULT_MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const ABSOLUTE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

export class FileRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FileRequestError";
    this.status = status;
  }
}

export type FileWriteContext = {
  client: SupabaseClient;
  user: User;
  accessMode: "service-role" | "session";
};

export async function requireFileWriteContext(
  request: Request,
): Promise<FileWriteContext> {
  assertSameOrigin(request);

  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) {
    throw new FileRequestError("Authentication required.", 401);
  }

  const admin = createAdminClient();
  return {
    client: admin ?? sessionClient,
    user,
    accessMode: admin ? "service-role" : "session",
  };
}

export function getMaxUploadBytes(): number {
  const raw =
    process.env.FILES_MAX_UPLOAD_BYTES ??
    process.env.IMPORTANT_FILES_MAX_UPLOAD_BYTES ??
    "";
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  return Math.min(parsed, ABSOLUTE_MAX_UPLOAD_BYTES);
}

export function sanitizeOriginalFilename(value: unknown): string {
  const normalized = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.trim();

  if (!normalized) {
    throw new FileRequestError("The file name is missing.");
  }

  return normalized.slice(0, 255);
}

export function sanitizeFolderPath(value: unknown): string {
  const path = normalizeFolderPath(String(value ?? ""));
  if (path.length > 1000) {
    throw new FileRequestError("The destination folder path is too long.");
  }
  return path;
}

export function sanitizeFolderName(value: unknown): string {
  const name = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  if (!name) {
    throw new FileRequestError("Enter a folder name.");
  }
  if (name === "." || name === ".." || /[\\/]/.test(name)) {
    throw new FileRequestError("Folder names cannot contain slashes.");
  }
  if (name.length > 255) {
    throw new FileRequestError("Folder names must be 255 characters or fewer.");
  }

  return name;
}

export function sanitizeText(
  value: unknown,
  maxLength: number,
  fallback = "",
): string {
  const text = String(value ?? fallback).trim();
  return text.slice(0, maxLength);
}

export function sanitizeDate(value: unknown): string | null {
  const date = String(value ?? "").trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new FileRequestError("The document date is invalid.");
  }
  return date;
}

export function extensionFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 1 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
}

export function titleFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const title = dot > 0 ? filename.slice(0, dot) : filename;
  return title.trim().slice(0, 255) || "Untitled file";
}

export function hashUploadToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function writeFileAudit(
  client: SupabaseClient,
  action: string,
  details: Record<string, unknown>,
  fileId: number | null = null,
): Promise<void> {
  try {
    const ownerId =
      typeof details.user_id === "string" && details.user_id.trim()
        ? details.user_id.trim()
        : null;

    await client.from("important_file_audits").insert({
      owner_id: ownerId,
      file_id: fileId,
      action: action.slice(0, 80),
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Auditing is best-effort so it never prevents the primary file action.
  }
}

export function isMissingFolderTableError(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("important_folders") &&
      (message.includes("does not exist") || message.includes("schema cache")))
  );
}

export function isMissingFolderManagementColumns(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes("important_folders") &&
      (message.includes("owner_id") ||
        message.includes("status") ||
        message.includes("recycle_batch_id")))
  );
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new FileRequestError("Invalid request origin.", 403);
  }

  const expectedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  if (expectedHost && originHost !== expectedHost) {
    throw new FileRequestError("Cross-site file actions are not allowed.", 403);
  }
}
