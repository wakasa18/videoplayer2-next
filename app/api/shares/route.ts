import { NextResponse } from "next/server";

import {
  buildPublicShareUrl,
  createShareToken,
  encryptShareToken,
  hashShareToken,
  normalizeShareFolderPath,
  requireShareOwnerContext,
  sanitizeDisplayName,
  sanitizeExpiry,
  sanitizeMaxDownloads,
  sanitizeShareMessage,
  sanitizeShareTitle,
  shareErrorResponse,
  ShareRequestError,
} from "@/lib/shares/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateSharePayload = {
  shareType?: unknown;
  fileId?: unknown;
  folderPath?: unknown;
  expiresAt?: unknown;
  maxDownloads?: unknown;
  allowDownloads?: unknown;
  shareTitle?: unknown;
  shareMessage?: unknown;
  displayName?: unknown;
};

export async function POST(request: Request) {
  try {
    const { client, user } = await requireShareOwnerContext(request);
    const payload = (await request.json()) as CreateSharePayload;
    const shareType = payload.shareType === "folder" ? "folder" : "file";
    const expiresAt = sanitizeExpiry(payload.expiresAt);
    const maxDownloads = sanitizeMaxDownloads(payload.maxDownloads);
    const allowDownloads = payload.allowDownloads !== false;
    const shareTitle = sanitizeShareTitle(payload.shareTitle);
    const shareMessage = sanitizeShareMessage(payload.shareMessage);
    const displayName = sanitizeDisplayName(payload.displayName);

    let fileId: number | null = null;
    let folderPath: string | null = null;
    let targetName = "Shared item";

    if (shareType === "file") {
      fileId = Number.parseInt(String(payload.fileId ?? ""), 10);
      if (!Number.isInteger(fileId) || fileId < 1) {
        throw new ShareRequestError("Select a valid file to share.");
      }
      const { data: file, error } = await client
        .from("important_files")
        .select("id,title,original_filename")
        .eq("id", fileId)
        .eq("owner_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw new ShareRequestError(error.message, 422);
      if (!file) throw new ShareRequestError("File not found.", 404);
      targetName = String(file.title || file.original_filename || `File ${fileId}`);
    } else {
      folderPath = normalizeShareFolderPath(payload.folderPath);
      const { data: folder, error: folderError } = await client
        .from("important_folders")
        .select("path,name")
        .eq("owner_id", user.id)
        .eq("path", folderPath)
        .eq("status", "active")
        .maybeSingle();
      if (folderError) throw new ShareRequestError(folderError.message, 422);

      if (!folder) {
        const { count, error: countError } = await client
          .from("important_files")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("status", "active")
          .or(`folder_path.eq.${escapePostgrest(folderPath)},folder_path.like.${escapePostgrest(`${folderPath}/%`)}`);
        if (countError) throw new ShareRequestError(countError.message, 422);
        if (!count) throw new ShareRequestError("Folder not found.", 404);
      }
      targetName = String(folder?.name || folderPath.split("/").at(-1) || "Shared folder");
    }

    const token = createShareToken();
    const now = new Date().toISOString();
    const { data: share, error } = await client
      .from("important_file_shares")
      .insert({
        owner_id: user.id,
        share_type: shareType,
        file_id: fileId,
        folder_path: folderPath,
        token_hash: hashShareToken(token),
        token_ciphertext: encryptShareToken(token),
        expires_at: expiresAt,
        max_downloads: maxDownloads,
        allow_downloads: allowDownloads,
        share_title: shareTitle,
        share_message: shareMessage,
        display_name: displayName,
        created_by: user.email ?? user.id,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error) throw new ShareRequestError(error.message, 422);

    return NextResponse.json({
      success: true,
      id: Number(share.id),
      targetName,
      publicUrl: buildPublicShareUrl(request, token),
    });
  } catch (error) {
    return shareErrorResponse(error);
  }
}

function escapePostgrest(value: string): string {
  return value.replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
