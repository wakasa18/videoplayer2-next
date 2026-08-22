import { NextResponse } from "next/server";

import {
  consumeShareDownload,
  listFolderArchiveFiles,
} from "@/lib/shares/data";
import { recordShareEvent, shareErrorResponse } from "@/lib/shares/server";
import { createZipBuffer } from "@/lib/shares/zip";
import { getFilesBucket } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const url = new URL(request.url);
  return createArchive(request, (await context.params).token, url.searchParams.get("path") ?? "", []);
}

function uniqueArchiveName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const slash = name.lastIndexOf("/");
  const folder = slash >= 0 ? name.slice(0, slash + 1) : "";
  const leaf = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = leaf.lastIndexOf(".");
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const extension = dot > 0 ? leaf.slice(dot) : "";
  let index = 2;
  let candidate = `${folder}${stem} (${index})${extension}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${folder}${stem} (${index})${extension}`;
  }
  used.add(candidate);
  return candidate;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const body = (await request.json()) as { path?: unknown; fileIds?: unknown };
    const fileIds = Array.isArray(body.fileIds)
      ? body.fileIds
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isInteger(value) && value > 0)
          .slice(0, 100)
      : [];
    return createArchive(
      request,
      (await context.params).token,
      String(body.path ?? ""),
      fileIds,
    );
  } catch (error) {
    return shareErrorResponse(error);
  }
}

async function createArchive(
  request: Request,
  token: string,
  path: string,
  fileIds: number[],
) {
  try {
    const { admin, share, files, archiveName } = await listFolderArchiveFiles(
      token,
      path,
      fileIds,
    );
    const rootPrefix = path ? `${path.replace(/\/$/, "")}/` : "";
    const entries = [];
    const usedNames = new Set<string>();

    for (const file of files) {
      const { data, error } = await admin.storage
        .from(getFilesBucket())
        .download(file.file_path);
      if (error || !data) {
        throw new Error(
          error?.message ?? `Could not read ${file.original_filename} from Storage.`,
        );
      }
      const folder = String(file.folder_path ?? "");
      const relativeFolder = rootPrefix && folder.startsWith(rootPrefix)
        ? folder.slice(rootPrefix.length)
        : folder === path
          ? ""
          : folder;
      const requestedName = [relativeFolder, file.original_filename].filter(Boolean).join("/");
      const uniqueName = uniqueArchiveName(requestedName, usedNames);
      entries.push({
        name: uniqueName,
        data: new Uint8Array(await data.arrayBuffer()),
      });
    }

    const zip = createZipBuffer(entries);
    await consumeShareDownload(admin, share);
    await recordShareEvent(admin, share.id, "archive_download", request, {
      file_count: files.length,
      bytes: files.reduce((sum, file) => sum + file.file_size, 0),
      selected: fileIds.length > 0,
      path,
    });

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(archiveName)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return shareErrorResponse(error);
  }
}
