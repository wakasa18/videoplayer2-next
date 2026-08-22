import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureFolderHierarchy } from "@/lib/files/folders";
import {
  extensionFromFilename,
  FileRequestError,
  requireFileWriteContext,
  sanitizeDate,
  sanitizeFolderPath,
  sanitizeOriginalFilename,
  sanitizeText,
  writeFileAudit,
} from "@/lib/files/server";
import { getFilesBucket } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FileActionPayload =
  | {
      action: "metadata";
      title?: unknown;
      originalName?: unknown;
      description?: unknown;
      category?: unknown;
      documentDate?: unknown;
    }
  | { action: "favorite"; favorite?: unknown }
  | { action: "move"; folderPath?: unknown }
  | { action: "trash" }
  | { action: "restore" };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireFileWriteContext(request);
    const payload = (await request.json()) as FileActionPayload;

    const { data: file, error: fileError } = await client
      .from("important_files")
      .select(
        "id,owner_id,title,original_filename,folder_path,file_path,status,is_favorite,recycle_batch_id",
      )
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fileError) throw new FileRequestError(fileError.message, 422);
    if (!file) throw new FileRequestError("File not found.", 404);

    const now = new Date().toISOString();

    if (payload.action === "metadata") {
      if (file.status !== "active") {
        throw new FileRequestError("Restore this file before editing it.", 409);
      }

      const title = sanitizeText(payload.title, 255);
      if (!title) throw new FileRequestError("Enter a file title.");
      const originalName = sanitizeOriginalFilename(payload.originalName);
      const update = {
        title,
        original_filename: originalName,
        file_extension: extensionFromFilename(originalName) || null,
        description: sanitizeText(payload.description, 5000) || null,
        category: sanitizeText(payload.category, 100) || null,
        document_date: sanitizeDate(payload.documentDate),
        updated_at: now,
      };

      const { error } = await client
        .from("important_files")
        .update(update)
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "active");
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, "file_metadata_updated", {
        file_id: id,
        user_id: user.id,
        title,
        original_name: originalName,
      }, id);
      return NextResponse.json({ success: true, file: update });
    }

    if (payload.action === "favorite") {
      if (file.status !== "active") {
        throw new FileRequestError("Restore this file before changing its favorite status.", 409);
      }
      const favorite = Boolean(payload.favorite);
      const { error } = await client
        .from("important_files")
        .update({ is_favorite: favorite, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "active");
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, favorite ? "file_favorited" : "file_unfavorited", {
        file_id: id,
        user_id: user.id,
      }, id);
      return NextResponse.json({ success: true, favorite });
    }

    if (payload.action === "move") {
      if (file.status !== "active") {
        throw new FileRequestError("Restore this file before moving it.", 409);
      }
      const folderPath = sanitizeFolderPath(payload.folderPath);
      if (folderPath) {
        await ensureFolderHierarchy(client, folderPath, user.id);
      }
      const { error } = await client
        .from("important_files")
        .update({ folder_path: folderPath || null, updated_at: now })
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "active");
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, "file_moved", {
        file_id: id,
        user_id: user.id,
        from: file.folder_path ?? "",
        to: folderPath,
      }, id);
      return NextResponse.json({ success: true, folderPath });
    }

    if (payload.action === "trash") {
      if (file.status !== "active") {
        throw new FileRequestError("This file is already in the Recycle Bin.", 409);
      }
      const batchId = randomUUID();
      const purgeAt = new Date(Date.now() + 30 * 86400_000).toISOString();
      const { error } = await client
        .from("important_files")
        .update({
          status: "deleted",
          deleted_at: now,
          purge_at: purgeAt,
          recycle_batch_id: batchId,
          updated_at: now,
        })
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "active");
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, "file_recycled", {
        file_id: id,
        user_id: user.id,
        batch_id: batchId,
      }, id);
      return NextResponse.json({ success: true, batchId });
    }

    if (payload.action === "restore") {
      if (file.status !== "deleted") {
        throw new FileRequestError("This file is not in the Recycle Bin.", 409);
      }
      const folderPath = sanitizeFolderPath(file.folder_path);
      if (folderPath) {
        await ensureFolderHierarchy(client, folderPath, user.id, {
          tolerateMissingTable: true,
        });
      }
      const { error } = await client
        .from("important_files")
        .update({
          status: "active",
          deleted_at: null,
          purge_at: null,
          recycle_batch_id: null,
          updated_at: now,
        })
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("status", "deleted");
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, "file_restored", {
        file_id: id,
        user_id: user.id,
      }, id);
      return NextResponse.json({ success: true });
    }

    throw new FileRequestError("Unsupported file action.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { client, user } = await requireFileWriteContext(request);
    const { data: file, error: fileError } = await client
      .from("important_files")
      .select("id,file_path,stored_filename,original_filename,status")
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("status", "deleted")
      .maybeSingle();

    if (fileError) throw new FileRequestError(fileError.message, 422);
    if (!file?.file_path) {
      throw new FileRequestError("Recycled file not found.", 404);
    }

    const bucket = client.storage.from(getFilesBucket());
    const sourcePath = String(file.file_path);
    const leaf = String(file.stored_filename || sourcePath.split("/").at(-1) || `file-${id}`);
    const stagedPath = `${user.id}/.delete-staging/${randomUUID()}/${leaf}`;

    const { error: stageError } = await bucket.move(sourcePath, stagedPath);
    if (stageError) {
      throw new FileRequestError(
        `The Storage object could not be staged for deletion: ${stageError.message}`,
        502,
      );
    }

    const { error: deleteError } = await client
      .from("important_files")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("status", "deleted");

    if (deleteError) {
      await bucket.move(stagedPath, sourcePath);
      throw new FileRequestError(deleteError.message, 422);
    }

    const { error: removeError } = await bucket.remove([stagedPath]);
    await writeFileAudit(client, "file_permanently_deleted", {
      deleted_file_id: id,
      original_name: file.original_filename,
      user_id: user.id,
      storage_cleanup_pending: Boolean(removeError),
    });

    return NextResponse.json({
      success: true,
      warning: removeError
        ? "The database record was deleted, but a staged Storage object may require cleanup."
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function parseId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new FileRequestError("Invalid file identifier.");
  }
  return id;
}

function errorResponse(error: unknown) {
  if (error instanceof FileRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "File action failed." },
    { status: 500 },
  );
}
