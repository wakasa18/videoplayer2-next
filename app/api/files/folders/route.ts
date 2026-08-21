import { NextResponse } from "next/server";

import { ensureFolderHierarchy } from "@/lib/files/folders";
import {
  FileRequestError,
  isMissingFolderTableError,
  requireFileWriteContext,
  sanitizeFolderName,
  sanitizeFolderPath,
  writeFileAudit,
} from "@/lib/files/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      .eq("path", path)
      .limit(1);

    if (existingError) {
      if (isMissingFolderTableError(existingError)) {
        throw new FileRequestError(
          "Run database/phase3a_important_folders.sql in the Supabase SQL Editor before creating empty folders.",
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
      .eq("status", "active")
      .eq("folder_path", path)
      .limit(1);

    if (directFile?.length) {
      throw new FileRequestError("A folder with this name already exists here.", 409);
    }

    await ensureFolderHierarchy(client, path);
    await writeFileAudit(client, "folder_created", {
      path,
      name,
      user_id: user.id,
    });

    return NextResponse.json({ success: true, folder: { name, path } });
  } catch (error) {
    if (error instanceof FileRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create folder." },
      { status: 500 },
    );
  }
}
