import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeFolderPath } from "@/lib/files/utils";
import {
  assertShareCanDownload,
  assertShareCanOpen,
  decryptShareToken,
  getShareState,
  hashShareToken,
  normalizeRelativePublicPath,
  requirePublicAdminClient,
  ShareRequestError,
  recordShareEvent,
} from "@/lib/shares/server";
import type {
  ImportantFileShare,
  PublicShareFile,
  PublicShareResult,
  ShareEvent,
  ShareListItem,
} from "@/lib/shares/types";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const SHARE_SELECT = [
  "id",
  "owner_id",
  "share_type",
  "file_id",
  "folder_path",
  "token_hash",
  "token_ciphertext",
  "expires_at",
  "max_downloads",
  "allow_downloads",
  "share_title",
  "share_message",
  "display_name",
  "view_count",
  "download_count",
  "last_accessed_at",
  "revoked_at",
  "created_by",
  "created_at",
  "updated_at",
].join(",");

const PUBLIC_FILE_SELECT = [
  "id",
  "title",
  "description",
  "category",
  "folder_path",
  "original_filename",
  "file_extension",
  "mime_type",
  "file_size",
  "document_date",
  "created_at",
  "updated_at",
].join(",");

export async function listOwnerShares(requestOrigin?: string): Promise<ShareListItem[]> {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) throw new ShareRequestError("Authentication required.", 401);

  const admin = requirePublicAdminClient();
  const { data, error } = await admin
    .from("important_file_shares")
    .select(SHARE_SELECT)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new ShareRequestError(error.message, 500);

  const shares = ((data ?? []) as unknown as ImportantFileShare[]).map(normalizeShare);
  const fileIds = shares
    .filter((share) => share.share_type === "file" && share.file_id)
    .map((share) => Number(share.file_id));
  const targetNames = new Map<number, string>();

  if (fileIds.length) {
    const { data: files } = await admin
      .from("important_files")
      .select("id,title,original_filename")
      .eq("owner_id", user.id)
      .in("id", fileIds);
    for (const file of files ?? []) {
      targetNames.set(
        Number(file.id),
        String(file.title || file.original_filename || `File ${file.id}`),
      );
    }
  }

  const base = (requestOrigin || process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "");

  return shares.map((share) => {
    const token = decryptShareToken(share.token_ciphertext);
    const publicUrl = token
      ? `${base || ""}/share/${encodeURIComponent(token)}`
      : null;
    return {
      ...share,
      target_name:
        share.share_type === "folder"
          ? share.folder_path?.split("/").at(-1) || "Shared folder"
          : targetNames.get(Number(share.file_id)) || "Shared file",
      public_url: publicUrl,
      state: getShareState(share),
    };
  });
}

export async function getOwnerShareAnalytics(shareId: number): Promise<{
  share: ShareListItem;
  events: ShareEvent[];
  eventCounts: Record<string, number>;
}> {
  const shares = await listOwnerShares();
  const share = shares.find((item) => item.id === shareId);
  if (!share) throw new ShareRequestError("Shared link not found.", 404);

  const admin = requirePublicAdminClient();
  const { data, error } = await admin
    .from("important_file_share_events")
    .select("id,share_id,file_id,event_type,details,created_at")
    .eq("share_id", shareId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new ShareRequestError(error.message, 500);

  const events = (data ?? []) as unknown as ShareEvent[];
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.event_type] = (eventCounts[event.event_type] ?? 0) + 1;
  }
  return { share, events, eventCounts };
}

export async function getPublicShare(
  token: string,
  requestedFolder = "",
): Promise<PublicShareResult> {
  const { admin, share } = await resolveShareToken(token);
  assertShareCanOpen(share);

  if (share.share_type === "file") {
    const { data: file, error } = await admin
      .from("important_files")
      .select(PUBLIC_FILE_SELECT)
      .eq("id", Number(share.file_id))
      .eq("owner_id", share.owner_id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new ShareRequestError(error.message, 500);
    if (!file) throw new ShareRequestError("The shared file is unavailable.", 404);

    const publicFile = normalizePublicFile(file as unknown as PublicShareFile);
    return {
      share,
      targetName: share.share_title || publicFile.title || publicFile.original_filename,
      rootFolder: "",
      currentFolder: "",
      breadcrumbs: [],
      folders: [],
      files: [publicFile],
      totalFiles: 1,
      totalBytes: publicFile.file_size,
    };
  }

  const root = normalizeFolderPath(share.folder_path);
  if (!root) throw new ShareRequestError("The shared folder is invalid.", 404);
  const current = normalizeRelativePublicPath(root, requestedFolder);

  const { data, error } = await admin
    .from("important_files")
    .select(PUBLIC_FILE_SELECT)
    .eq("owner_id", share.owner_id)
    .eq("status", "active")
    .or(`folder_path.eq.${escapePostgrestValue(root)},folder_path.like.${escapePostgrestValue(`${root}/%`)}`)
    .order("title", { ascending: true })
    .limit(5001);
  if (error) throw new ShareRequestError(error.message, 500);

  const allFiles = ((data ?? []) as unknown as PublicShareFile[])
    .slice(0, 5000)
    .map(normalizePublicFile);
  const directFiles = allFiles.filter(
    (file) => normalizeFolderPath(file.folder_path) === current,
  );
  const folders = buildPublicChildFolders(allFiles, current);

  return {
    share,
    targetName: share.share_title || root.split("/").at(-1) || "Shared folder",
    rootFolder: root,
    currentFolder: current,
    breadcrumbs: buildPublicBreadcrumbs(root, current),
    folders,
    files: directFiles,
    totalFiles: allFiles.length,
    totalBytes: allFiles.reduce((sum, file) => sum + file.file_size, 0),
  };
}


export async function registerPublicShareOpen(
  token: string,
  request: Request,
): Promise<void> {
  const { admin, share } = await resolveShareToken(token);
  assertShareCanOpen(share);
  await Promise.allSettled([
    registerShareView(admin, share.id),
    recordShareEvent(admin, share.id, "view", request, {
      share_type: share.share_type,
    }),
  ]);
}

export async function resolvePublicFile(
  token: string,
  fileId: number,
  forDownload = false,
): Promise<{
  admin: SupabaseClient;
  share: ImportantFileShare;
  file: {
    id: number;
    owner_id: string;
    title: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    file_path: string;
    folder_path: string | null;
    download_count: number;
  };
}> {
  const { admin, share } = await resolveShareToken(token);
  if (forDownload) assertShareCanDownload(share);
  else assertShareCanOpen(share);

  const { data: file, error } = await admin
    .from("important_files")
    .select(
      "id,owner_id,title,original_filename,mime_type,file_size,file_path,folder_path,download_count",
    )
    .eq("id", fileId)
    .eq("owner_id", share.owner_id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new ShareRequestError(error.message, 500);
  if (!file?.file_path) throw new ShareRequestError("Shared file not found.", 404);

  if (share.share_type === "file") {
    if (Number(share.file_id) !== fileId) {
      throw new ShareRequestError("This file is not part of the shared link.", 403);
    }
  } else {
    const root = normalizeFolderPath(share.folder_path);
    const folder = normalizeFolderPath(file.folder_path);
    if (!root || (folder !== root && !folder.startsWith(`${root}/`))) {
      throw new ShareRequestError("This file is not part of the shared folder.", 403);
    }
  }

  return {
    admin,
    share,
    file: {
      ...file,
      id: Number(file.id),
      owner_id: String(file.owner_id),
      title: String(file.title ?? file.original_filename),
      original_filename: String(file.original_filename),
      mime_type: String(file.mime_type ?? "application/octet-stream"),
      file_size: Number(file.file_size ?? 0),
      file_path: String(file.file_path),
      folder_path: file.folder_path ? String(file.folder_path) : null,
      download_count: Number(file.download_count ?? 0),
    },
  };
}

export async function consumeShareDownload(
  admin: SupabaseClient,
  share: ImportantFileShare,
): Promise<void> {
  const { data, error } = await admin.rpc("consume_important_share_download", {
    p_share_id: share.id,
  });
  if (error) throw new ShareRequestError(error.message, 500);
  if (data !== true) {
    throw new ShareRequestError(
      "This shared link is no longer available for downloads.",
      410,
    );
  }
}

export async function registerShareView(
  admin: SupabaseClient,
  shareId: number,
): Promise<void> {
  try {
    await admin.rpc("register_important_share_view", { p_share_id: shareId });
  } catch {
    // Views are best-effort.
  }
}

export async function listFolderArchiveFiles(
  token: string,
  requestedPath: string,
  selectedIds: number[] = [],
): Promise<{
  admin: SupabaseClient;
  share: ImportantFileShare;
  files: Array<{
    id: number;
    file_path: string;
    original_filename: string;
    file_size: number;
    folder_path: string | null;
  }>;
  archiveName: string;
}> {
  const { admin, share } = await resolveShareToken(token);
  assertShareCanDownload(share);
  if (share.share_type !== "folder") {
    throw new ShareRequestError("This shared link does not contain a folder.", 400);
  }

  const root = normalizeFolderPath(share.folder_path);
  const path = normalizeRelativePublicPath(root, requestedPath);
  let query = admin
    .from("important_files")
    .select("id,file_path,original_filename,file_size,folder_path")
    .eq("owner_id", share.owner_id)
    .eq("status", "active")
    .or(`folder_path.eq.${escapePostgrestValue(path)},folder_path.like.${escapePostgrestValue(`${path}/%`)}`)
    .limit(101);
  if (selectedIds.length) query = query.in("id", selectedIds);

  const { data, error } = await query;
  if (error) throw new ShareRequestError(error.message, 500);
  const files = (data ?? [])
    .filter((file) => Boolean(file.file_path))
    .slice(0, 100)
    .map((file) => ({
      id: Number(file.id),
      file_path: String(file.file_path),
      original_filename: String(file.original_filename),
      file_size: Number(file.file_size ?? 0),
      folder_path: file.folder_path ? String(file.folder_path) : null,
    }));
  if (!files.length) throw new ShareRequestError("No files were selected.", 404);

  const totalBytes = files.reduce((sum, file) => sum + file.file_size, 0);
  if (totalBytes > 250 * 1024 * 1024) {
    throw new ShareRequestError(
      "The ZIP selection is larger than 250 MB. Download fewer files at a time.",
      413,
    );
  }

  return {
    admin,
    share,
    files,
    archiveName: `${path.split("/").at(-1) || "shared-folder"}.zip`,
  };
}

async function resolveShareToken(token: string): Promise<{
  admin: SupabaseClient;
  share: ImportantFileShare;
}> {
  const clean = String(token ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(clean)) {
    throw new ShareRequestError("Invalid shared link.", 404);
  }
  const admin = requirePublicAdminClient();
  const { data, error } = await admin
    .from("important_file_shares")
    .select(SHARE_SELECT)
    .eq("token_hash", hashShareToken(clean))
    .maybeSingle();
  if (error) throw new ShareRequestError(error.message, 500);
  if (!data) throw new ShareRequestError("Shared link not found.", 404);
  return { admin, share: normalizeShare(data as unknown as ImportantFileShare) };
}

function normalizeShare(share: ImportantFileShare): ImportantFileShare {
  return {
    ...share,
    id: Number(share.id),
    file_id: share.file_id === null ? null : Number(share.file_id),
    folder_path: share.folder_path ? normalizeFolderPath(share.folder_path) : null,
    max_downloads:
      share.max_downloads === null ? null : Number(share.max_downloads),
    allow_downloads: Boolean(share.allow_downloads),
    view_count: Number(share.view_count ?? 0),
    download_count: Number(share.download_count ?? 0),
  };
}

function normalizePublicFile(file: PublicShareFile): PublicShareFile {
  return {
    ...file,
    id: Number(file.id),
    file_size: Number(file.file_size ?? 0),
    folder_path: normalizeFolderPath(file.folder_path),
  };
}

function buildPublicChildFolders(
  files: PublicShareFile[],
  current: string,
): PublicShareResult["folders"] {
  const prefix = current ? `${current}/` : "";
  const map = new Map<string, PublicShareResult["folders"][number]>();
  for (const file of files) {
    const path = normalizeFolderPath(file.folder_path);
    if (!path.startsWith(prefix) || path === current) continue;
    const remainder = path.slice(prefix.length);
    const name = remainder.split("/")[0];
    if (!name) continue;
    const childPath = `${prefix}${name}`;
    const item = map.get(childPath) ?? {
      name,
      path: childPath,
      fileCount: 0,
      totalBytes: 0,
    };
    item.fileCount += 1;
    item.totalBytes += file.file_size;
    map.set(childPath, item);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildPublicBreadcrumbs(
  root: string,
  current: string,
): Array<{ label: string; path: string }> {
  const rootParts = root.split("/");
  const currentParts = current.split("/");
  const crumbs = [
    { label: rootParts.at(-1) || "Shared folder", path: root },
  ];
  for (let i = rootParts.length; i < currentParts.length; i += 1) {
    crumbs.push({
      label: currentParts[i],
      path: currentParts.slice(0, i + 1).join("/"),
    });
  }
  return crumbs;
}

function escapePostgrestValue(value: string): string {
  return value.replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
