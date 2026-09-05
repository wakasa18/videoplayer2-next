import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureFolderHierarchy } from "@/lib/files/folders";
import {
  extensionFromFilename,
  FileRequestError,
  getMaxUploadBytes,
  hashUploadToken,
  requireFileWriteContext,
  sanitizeDate,
  sanitizeFolderPath,
  sanitizeOriginalFilename,
  sanitizeText,
  titleFromFilename,
  writeFileAudit,
} from "@/lib/files/server";
import { consumeRateLimit, rateLimitValue } from "@/lib/maintenance/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PreparePayload = {
  originalName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
  folderPath?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  documentDate?: unknown;
  checksumSha256?: unknown;
  duplicateStrategy?: unknown;
  replaceFileId?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user, accessMode } = await requireFileWriteContext(request);
    const rateLimit = await consumeRateLimit(client, user.id, "file-upload-prepare", rateLimitValue("FILE_UPLOAD_RATE_LIMIT", 30), 900);
    if (!rateLimit.allowed) throw new FileRequestError(`Too many upload attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`, 429);
    const payload = (await request.json()) as PreparePayload;

    const originalName = sanitizeOriginalFilename(payload.originalName);
    const fileSize = Number(payload.fileSize);
    const maxUploadBytes = getMaxUploadBytes();

    if (!Number.isSafeInteger(fileSize) || fileSize < 1) {
      throw new FileRequestError("Empty files cannot be uploaded.");
    }
    if (fileSize > maxUploadBytes) {
      throw new FileRequestError(
        `This file is larger than the configured upload limit of ${formatBytes(maxUploadBytes)}.`,
        413,
      );
    }

    const folderPath = sanitizeFolderPath(payload.folderPath);
    const extension = extensionFromFilename(originalName);
    const mimeType =
      sanitizeText(payload.mimeType, 150, "application/octet-stream") ||
      "application/octet-stream";
    const title =
      sanitizeText(payload.title, 255) || titleFromFilename(originalName);
    const description = sanitizeText(payload.description, 5000) || null;
    const category = sanitizeText(payload.category, 100) || null;
    const documentDate = sanitizeDate(payload.documentDate);
    const checksumSha256 = String(payload.checksumSha256 ?? "").trim().toLowerCase();
    if (checksumSha256 && !/^[a-f0-9]{64}$/.test(checksumSha256)) {
      throw new FileRequestError("The duplicate-check checksum is invalid.");
    }
    const duplicateStrategy = String(payload.duplicateStrategy ?? "");
    const requestedReplaceId = Number.parseInt(String(payload.replaceFileId ?? ""), 10);

    if (folderPath) {
      await ensureFolderHierarchy(client, folderPath, user.id, {
        tolerateMissingTable: true,
      });
    }

    const storedFilename = `${randomBytes(20).toString("hex")}${
      extension ? `.${extension}` : ""
    }`;
    const now = new Date();
    const objectPath = `${user.id}/${now.getUTCFullYear()}/${String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0")}/${storedFilename}`;
    const uploadToken = randomBytes(32).toString("hex");
    const uploadTokenHash = hashUploadToken(uploadToken);
    const timestamp = now.toISOString();

    let duplicateQuery = client
      .from("important_files")
      .select("id,title,original_filename,file_size,folder_path,checksum_sha256")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .eq("file_size", fileSize)
      .limit(5);
    if (checksumSha256) duplicateQuery = duplicateQuery.eq("checksum_sha256", checksumSha256);
    else duplicateQuery = duplicateQuery.eq("original_filename", originalName);
    const { data: duplicateRows } = await duplicateQuery;
    const duplicateFile = duplicateRows?.[0] ?? null;
    if (duplicateFile && !["keep_both", "replace"].includes(duplicateStrategy)) {
      return NextResponse.json({
        error: "An identical or likely duplicate file already exists.",
        code: "DUPLICATE",
        duplicate: {
          id: Number(duplicateFile.id),
          title: String(duplicateFile.title ?? duplicateFile.original_filename),
          originalFilename: String(duplicateFile.original_filename),
          fileSize: Number(duplicateFile.file_size ?? 0),
          exact: Boolean(checksumSha256 && duplicateFile.checksum_sha256 === checksumSha256),
        },
      }, { status: 409 });
    }
    const replaceFileId = duplicateStrategy === "replace" && Number.isInteger(requestedReplaceId)
      ? requestedReplaceId
      : duplicateStrategy === "replace" && duplicateFile?.id
        ? Number(duplicateFile.id)
        : null;

    const { data: pendingFile, error: insertError } = await client
      .from("important_files")
      .insert({
        owner_id: user.id,
        title,
        description,
        category,
        folder_path: folderPath || null,
        stored_filename: storedFilename,
        original_filename: originalName,
        file_path: objectPath,
        file_extension: extension || null,
        mime_type: mimeType,
        file_size: fileSize,
        checksum_sha256: checksumSha256 || null,
        replacement_of_id: replaceFileId,
        upload_token_hash: uploadTokenHash,
        status: "pending",
        document_date: documentDate,
        is_favorite: false,
        download_count: 0,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id")
      .single();

    if (insertError || !pendingFile?.id) {
      throw new FileRequestError(
        insertError?.message ?? "Could not create the pending upload.",
        422,
      );
    }

    const fileId = Number(pendingFile.id);

    await writeFileAudit(
      client,
      "upload_prepared",
      {
        name: originalName,
        size: fileSize,
        folder: folderPath,
        user_id: user.id,
        access_mode: accessMode,
      },
      fileId,
    );

    return NextResponse.json({
      fileId,
      uploadToken,
      objectPath,
      duplicate: Boolean(duplicateFile),
      replaceFileId,
      maxUploadBytes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof FileRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Could not prepare upload.",
    },
    { status: 500 },
  );
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(mb))} MB`;
}
