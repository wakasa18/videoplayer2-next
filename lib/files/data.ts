import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FileBrowserFilters,
  FileBrowserResult,
  FolderSummary,
  ImportantFile,
  ImportantFolder,
  RecycleBinResult,
} from "@/lib/files/types";
import {
  compareFiles,
  getFileType,
  matchesSearch,
  normalizeFolderPath,
} from "@/lib/files/utils";
import {
  isMissingFolderTableError,
  isMissingFolderManagementColumns,
} from "@/lib/files/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const SNAPSHOT_LIMIT = 5001;
const FILE_SELECT = [
  "id",
  "owner_id",
  "title",
  "description",
  "category",
  "folder_path",
  "original_filename",
  "file_extension",
  "mime_type",
  "file_size",
  "status",
  "document_date",
  "expires_at",
  "is_favorite",
  "download_count",
  "created_at",
  "updated_at",
  "deleted_at",
  "recycle_batch_id",
].join(",");

async function getDataContext(): Promise<{
  client: SupabaseClient;
  userId: string;
  accessMode: "service-role" | "session";
}> {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required.");
  }

  const admin = createAdminClient();
  return {
    client: admin ?? sessionClient,
    userId: user.id,
    accessMode: admin ? "service-role" : "session",
  };
}

export async function getImportantFilesBrowser(
  filters: FileBrowserFilters,
): Promise<FileBrowserResult> {
  const { client, userId, accessMode } = await getDataContext();
  const { data, error } = await client
    .from("important_files")
    .select(FILE_SELECT)
    .eq("owner_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);

  if (error) {
    throw new Error(
      accessMode === "session"
        ? `${error.message}. Add the server-only SUPABASE_SERVICE_ROLE_KEY environment variable, or configure authenticated owner policies for important_files.`
        : error.message,
    );
  }

  const { folders: explicitFolders, available: folderTableAvailable } =
    await getExplicitFolders(client, userId, "active");

  const rawFiles = (data ?? []) as unknown as ImportantFile[];
  const truncated = rawFiles.length >= SNAPSHOT_LIMIT;
  const allFiles = rawFiles.slice(0, SNAPSHOT_LIMIT - 1).map(normalizeFile);

  const categories = Array.from(
    new Set(
      allFiles
        .map((file) => String(file.category ?? "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const folders = buildChildFolders(
    allFiles,
    explicitFolders,
    filters.folder,
    filters.q,
  );
  const directFiles = filters.favorite
    ? allFiles
    : allFiles.filter(
        (file) => normalizeFolderPath(file.folder_path) === filters.folder,
      );

  const filteredFiles = directFiles
    .filter((file) => matchesSearch(file, filters.q))
    .filter((file) => !filters.type || getFileType(file) === filters.type)
    .filter(
      (file) =>
        !filters.category ||
        String(file.category ?? "").toLocaleLowerCase() ===
          filters.category.toLocaleLowerCase(),
    )
    .filter((file) => !filters.favorite || file.is_favorite)
    .sort((a, b) => {
      const favoriteCompare = Number(b.is_favorite) - Number(a.is_favorite);
      return favoriteCompare || compareFiles(a, b, filters.sort);
    });

  const totalFiles = filteredFiles.length;
  const totalPages = Math.max(1, Math.ceil(totalFiles / filters.perPage));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.perPage;
  const files = filteredFiles.slice(start, start + filters.perPage);

  return {
    files,
    folders: filters.favorite ? [] : folders,
    categories,
    breadcrumbs: buildBreadcrumbs(filters.folder),
    totalFiles,
    totalPages,
    totalBytes: filteredFiles.reduce((total, file) => total + file.file_size, 0),
    page,
    perPage: filters.perPage,
    truncated,
    accessMode,
    folderTableAvailable,
  };
}

export async function getImportantFileById(
  id: number,
  options: { includeDeleted?: boolean } = {},
): Promise<{
  file: ImportantFile | null;
  accessMode: "service-role" | "session";
}> {
  const { client, userId, accessMode } = await getDataContext();
  let query = client
    .from("important_files")
    .select(FILE_SELECT)
    .eq("id", id)
    .eq("owner_id", userId);

  query = options.includeDeleted
    ? query.in("status", ["active", "deleted"])
    : query.eq("status", "active");

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);

  return {
    file: data ? normalizeFile(data as unknown as ImportantFile) : null,
    accessMode,
  };
}

export async function getImportantFilesRecycleBin(): Promise<RecycleBinResult> {
  const { client, userId, accessMode } = await getDataContext();
  const { data, error } = await client
    .from("important_files")
    .select(FILE_SELECT)
    .eq("owner_id", userId)
    .eq("status", "deleted")
    .order("deleted_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);

  if (error) throw new Error(error.message);

  const { folders: deletedFolders, available: folderTableAvailable } =
    await getExplicitFolders(client, userId, "deleted");
  const files = ((data ?? []) as unknown as ImportantFile[]).map(normalizeFile);

  const folderByPath = new Map(
    deletedFolders.map((folder) => [normalizeFolderPath(folder.path), folder]),
  );
  const rootFolders = deletedFolders
    .filter((folder) => {
      const parent = normalizeFolderPath(folder.parent_path);
      if (!parent) return true;
      const parentFolder = folderByPath.get(parent);
      return !parentFolder || parentFolder.recycle_batch_id !== folder.recycle_batch_id;
    })
    .map<FolderSummary>((folder) => {
      const path = normalizeFolderPath(folder.path);
      const folderFiles = files.filter(
        (file) =>
          normalizeFolderPath(file.folder_path) === path ||
          normalizeFolderPath(file.folder_path).startsWith(`${path}/`),
      );
      return {
        name: folder.name || path.split("/").at(-1) || path,
        path,
        fileCount: folderFiles.length,
        totalBytes: folderFiles.reduce((sum, file) => sum + file.file_size, 0),
        updatedAt: folder.updated_at ?? folder.created_at,
        deletedAt: folder.deleted_at ?? null,
        recycleBatchId: folder.recycle_batch_id ?? null,
      };
    })
    .sort((a, b) =>
      String(b.deletedAt ?? "").localeCompare(String(a.deletedAt ?? "")),
    );

  const folderBatches = new Set(
    rootFolders.map((folder) => folder.recycleBatchId).filter(Boolean),
  );
  const standaloneFiles = files.filter(
    (file) => !file.recycle_batch_id || !folderBatches.has(file.recycle_batch_id),
  );

  return {
    files: standaloneFiles,
    folders: rootFolders,
    totalBytes: files.reduce((sum, file) => sum + file.file_size, 0),
    accessMode,
    folderTableAvailable,
  };
}

function normalizeFile(file: ImportantFile): ImportantFile {
  return {
    ...file,
    folder_path: normalizeFolderPath(file.folder_path),
    file_size: Number(file.file_size) || 0,
    download_count: Number(file.download_count) || 0,
    is_favorite: Boolean(file.is_favorite),
    deleted_at: file.deleted_at ?? null,
  };
}

function buildChildFolders(
  files: ImportantFile[],
  explicitFolders: ImportantFolder[],
  currentFolder: string,
  query: string,
): FolderSummary[] {
  const prefix = currentFolder ? `${currentFolder}/` : "";
  const folders = new Map<string, FolderSummary>();
  const normalizedQuery = query.toLocaleLowerCase();

  for (const file of files) {
    const path = normalizeFolderPath(file.folder_path);
    if (!path || (prefix && !path.startsWith(prefix))) continue;

    const remainder = prefix ? path.slice(prefix.length) : path;
    const childName = remainder.split("/")[0];
    if (!childName) continue;

    const childPath = prefix ? `${currentFolder}/${childName}` : childName;
    const existing = folders.get(childPath) ?? {
      name: childName,
      path: childPath,
      fileCount: 0,
      totalBytes: 0,
      updatedAt: null,
    };

    existing.fileCount += 1;
    existing.totalBytes += file.file_size;

    const candidateDate = file.updated_at ?? file.created_at;
    if (
      candidateDate &&
      (!existing.updatedAt ||
        new Date(candidateDate).getTime() >
          new Date(existing.updatedAt).getTime())
    ) {
      existing.updatedAt = candidateDate;
    }

    folders.set(childPath, existing);
  }

  for (const folder of explicitFolders) {
    const path = normalizeFolderPath(folder.path);
    const parent = normalizeFolderPath(folder.parent_path);
    if (!path || parent !== currentFolder) continue;

    const existing = folders.get(path) ?? {
      name: folder.name || path.split("/").at(-1) || path,
      path,
      fileCount: 0,
      totalBytes: 0,
      updatedAt: folder.updated_at ?? folder.created_at,
    };

    const explicitDate = folder.updated_at ?? folder.created_at;
    if (
      explicitDate &&
      (!existing.updatedAt ||
        new Date(explicitDate).getTime() >
          new Date(existing.updatedAt).getTime())
    ) {
      existing.updatedAt = explicitDate;
    }

    folders.set(path, existing);
  }

  return Array.from(folders.values())
    .filter(
      (folder) =>
        !normalizedQuery ||
        folder.name.toLocaleLowerCase().includes(normalizedQuery),
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

async function getExplicitFolders(
  client: SupabaseClient,
  userId: string,
  status: "active" | "deleted",
): Promise<{ folders: ImportantFolder[]; available: boolean }> {
  const { data, error } = await client
    .from("important_folders")
    .select(
      "id,owner_id,path,name,parent_path,status,created_at,updated_at,deleted_at,recycle_batch_id",
    )
    .eq("owner_id", userId)
    .eq("status", status)
    .order("name", { ascending: true })
    .limit(5000);

  if (!error) {
    return {
      folders: (data ?? []) as unknown as ImportantFolder[],
      available: true,
    };
  }

  if (isMissingFolderTableError(error) || isMissingFolderManagementColumns(error)) {
    return { folders: [], available: false };
  }

  throw new Error(error.message);
}

function buildBreadcrumbs(folder: string) {
  const crumbs: Array<{ label: string; path: string }> = [
    { label: "Important Files", path: "" },
  ];
  if (!folder) return crumbs;

  const parts = folder.split("/").filter(Boolean);
  let path = "";
  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    crumbs.push({ label: part, path });
  }

  return crumbs;
}

export type FileAuditItem = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export async function getRecentImportantFiles(limit = 60): Promise<ImportantFile[]> {
  const { client, userId } = await getDataContext();
  const { data, error } = await client
    .from("important_files")
    .select(`${FILE_SELECT},last_opened_at,last_previewed_at,last_downloaded_at,checksum_sha256,checksum_verified_at`)
    .eq("owner_id", userId)
    .eq("status", "active")
    .not("last_opened_at", "is", null)
    .order("last_opened_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw new Error(`${error.message}. Run database/phase13_selected_features.sql.`);
  return ((data ?? []) as unknown as ImportantFile[]).map(normalizeFile);
}

export async function getImportantFileActivity(fileId: number, limit = 30): Promise<FileAuditItem[]> {
  const { client, userId } = await getDataContext();
  const { data, error } = await client
    .from("important_file_audits")
    .select("id,action,details,created_at")
    .eq("owner_id", userId)
    .eq("file_id", fileId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    action: String(row.action),
    details: row.details && typeof row.details === "object" ? row.details as Record<string, unknown> : {},
    created_at: String(row.created_at),
  }));
}

export async function getImportantFileIntegrity(fileId: number): Promise<{
  checksum_sha256: string | null;
  checksum_verified_at: string | null;
}> {
  const { client, userId } = await getDataContext();
  const { data, error } = await client
    .from("important_files")
    .select("checksum_sha256,checksum_verified_at")
    .eq("owner_id", userId)
    .eq("id", fileId)
    .maybeSingle();
  if (error) return { checksum_sha256: null, checksum_verified_at: null };
  return {
    checksum_sha256: data?.checksum_sha256 ? String(data.checksum_sha256) : null,
    checksum_verified_at: data?.checksum_verified_at ? String(data.checksum_verified_at) : null,
  };
}
