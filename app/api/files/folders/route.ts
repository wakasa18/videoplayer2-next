import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureFolderHierarchy } from "@/lib/files/folders";
import {
  FileRequestError,
  isMissingFolderManagementColumns,
  isMissingFolderTableError,
  requireFileWriteContext,
  sanitizeFolderName,
  sanitizeFolderPath,
  writeFileAudit,
} from "@/lib/files/server";
import { getFilesBucket } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { client, user } = await requireFileWriteContext(request);
    const { data, error } = await client
      .from("important_folders")
      .select("path,name,parent_path")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .order("path", { ascending: true })
      .limit(5000);

    if (error) {
      if (isMissingFolderTableError(error) || isMissingFolderManagementColumns(error)) {
        throw new FileRequestError(
          "Run database/phase3b_file_management.sql before managing folders.",
          503,
        );
      }
      throw new FileRequestError(error.message, 422);
    }

    return NextResponse.json({ folders: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireFileWriteContext(request);
    const payload = (await request.json()) as {
      name?: unknown;
      parentPath?: unknown;
    };
    const name = sanitizeFolderName(payload.name);
    const parentPath = sanitizeFolderPath(payload.parentPath);
    const path = sanitizeFolderPath(parentPath ? `${parentPath}/${name}` : name);

    const { data: existing, error: existingError } = await client
      .from("important_folders")
      .select("id")
      .eq("owner_id", user.id)
      .eq("path", path)
      .eq("status", "active")
      .limit(1);

    if (existingError) {
      if (
        isMissingFolderTableError(existingError) ||
        isMissingFolderManagementColumns(existingError)
      ) {
        throw new FileRequestError(
          "Run database/phase3b_file_management.sql in the Supabase SQL Editor before creating folders.",
          503,
        );
      }
      throw new FileRequestError(existingError.message, 422);
    }

    if (existing?.length) {
      throw new FileRequestError("A folder with this name already exists here.", 409);
    }

    const { data: directFile } = await client
      .from("important_files")
      .select("id")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .eq("folder_path", path)
      .limit(1);

    if (directFile?.length) {
      throw new FileRequestError("A folder with this name already exists here.", 409);
    }

    await ensureFolderHierarchy(client, path, user.id);
    await writeFileAudit(client, "folder_created", {
      path,
      name,
      user_id: user.id,
    });

    return NextResponse.json({ success: true, folder: { name, path } });
  } catch (error) {
    return errorResponse(error);
  }
}

type FolderPatchPayload =
  | {
      action: "move";
      sourcePath?: unknown;
      destinationParent?: unknown;
      name?: unknown;
    }
  | { action: "trash"; sourcePath?: unknown }
  | { action: "restore"; sourcePath?: unknown };

export async function PATCH(request: Request) {
  try {
    const { client, user } = await requireFileWriteContext(request);
    const payload = (await request.json()) as FolderPatchPayload;
    const sourcePath = sanitizeFolderPath(payload.sourcePath);
    if (!sourcePath) throw new FileRequestError("Select a folder.");

    if (payload.action === "move") {
      const destinationParent = sanitizeFolderPath(payload.destinationParent);
      const name = sanitizeFolderName(payload.name);
      if (
        destinationParent &&
        (destinationParent === sourcePath ||
          destinationParent.startsWith(`${sourcePath}/`))
      ) {
        throw new FileRequestError("A folder cannot be moved inside itself.", 409);
      }

      if (destinationParent) {
        const { data: destination } = await client
          .from("important_folders")
          .select("id")
          .eq("owner_id", user.id)
          .eq("path", destinationParent)
          .eq("status", "active")
          .limit(1);
        if (!destination?.length) {
          throw new FileRequestError("The destination folder no longer exists.", 404);
        }
      }

      const { data, error } = await client.rpc("phase3b_move_important_folder", {
        p_owner_id: user.id,
        p_source_path: sourcePath,
        p_destination_parent: destinationParent,
        p_new_name: name,
      });
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, "folder_moved", {
        user_id: user.id,
        from: sourcePath,
        destination_parent: destinationParent,
        name,
        result: data,
      });
      return NextResponse.json({ success: true, result: data });
    }

    if (payload.action === "trash") {
      const batchId = randomUUID();
      const { data, error } = await client.rpc("phase3b_trash_important_folder", {
        p_owner_id: user.id,
        p_source_path: sourcePath,
        p_batch_id: batchId,
      });
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, "folder_recycled", {
        user_id: user.id,
        path: sourcePath,
        batch_id: batchId,
        result: data,
      });
      return NextResponse.json({ success: true, result: data });
    }

    if (payload.action === "restore") {
      const { data, error } = await client.rpc("phase3b_restore_important_folder", {
        p_owner_id: user.id,
        p_source_path: sourcePath,
      });
      if (error) throw new FileRequestError(error.message, 422);

      await writeFileAudit(client, "folder_restored", {
        user_id: user.id,
        path: sourcePath,
        result: data,
      });
      return NextResponse.json({ success: true, result: data });
    }

    throw new FileRequestError("Unsupported folder action.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { client, user } = await requireFileWriteContext(request);
    const url = new URL(request.url);
    const sourcePath = sanitizeFolderPath(url.searchParams.get("path"));
    if (!sourcePath) throw new FileRequestError("Select a recycled folder.");

    const { data: files, error: filesError } = await client
      .from("important_files")
      .select("id,file_path,stored_filename,folder_path")
      .eq("owner_id", user.id)
      .eq("status", "deleted")
      .limit(5000);
    if (filesError) throw new FileRequestError(filesError.message, 422);

    const matching = (files ?? []).filter((file) => {
      const folder = String(file.folder_path ?? "");
      return folder === sourcePath || folder.startsWith(`${sourcePath}/`);
    });
    if ((files ?? []).length >= 5000) {
      throw new FileRequestError(
        "This folder contains too many recycled files for one deletion request.",
        413,
      );
    }

    const bucket = client.storage.from(getFilesBucket());
    const staged: Array<{ from: string; to: string }> = [];
    const stagingRoot = `${user.id}/.delete-staging/${randomUUID()}`;

    for (const file of matching) {
      const from = String(file.file_path ?? "");
      if (!from) continue;
      const leaf = String(file.stored_filename || from.split("/").at(-1) || `file-${file.id}`);
      const to = `${stagingRoot}/${file.id}-${leaf}`;
      const { error } = await bucket.move(from, to);
      if (error) {
        for (const item of staged.reverse()) {
          await bucket.move(item.to, item.from);
        }
        throw new FileRequestError(
          `Storage staging failed for one file: ${error.message}`,
          502,
        );
      }
      staged.push({ from, to });
    }

    const { data, error } = await client.rpc("phase3b_delete_important_folder", {
      p_owner_id: user.id,
      p_source_path: sourcePath,
    });
    if (error) {
      for (const item of staged.reverse()) {
        await bucket.move(item.to, item.from);
      }
      throw new FileRequestError(error.message, 422);
    }

    const cleanup = staged.length
      ? await bucket.remove(staged.map((item) => item.to))
      : { error: null };

    await writeFileAudit(client, "folder_permanently_deleted", {
      user_id: user.id,
      path: sourcePath,
      result: data,
      storage_cleanup_pending: Boolean(cleanup.error),
    });

    return NextResponse.json({
      success: true,
      result: data,
      warning: cleanup.error
        ? "Records were deleted, but staged Storage objects may require cleanup."
        : null,
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
    { error: error instanceof Error ? error.message : "Folder action failed." },
    { status: 500 },
  );
}
