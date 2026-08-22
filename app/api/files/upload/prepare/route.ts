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
import { getFilesBucket } from "@/lib/supabase/admin";

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
};

export async function POST(request: Request) {
  try {
    const { client, user, accessMode } = await requireFileWriteContext(request);
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
      .select("id")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .eq("original_filename", originalName)
      .limit(1);

    duplicateQuery = folderPath
      ? duplicateQuery.eq("folder_path", folderPath)
      : duplicateQuery.is("folder_path", null);

    const { data: duplicateRows } = await duplicateQuery;
    const duplicate = Boolean(duplicateRows?.length);

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
        checksum_sha256: null,
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
    const { data: signed, error: signedError } = await client.storage
      .from(getFilesBucket())
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (signedError || !signed?.signedUrl || !signed.token) {
      await client
        .from("important_files")
        .delete()
        .eq("id", fileId)
        .eq("owner_id", user.id);
      throw new FileRequestError(
        signedError?.message ?? "Could not prepare the private upload URL.",
        502,
      );
    }

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
      signedUrl: signed.signedUrl,
      storageToken: signed.token,
      objectPath,
      duplicate,
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
