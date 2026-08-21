import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FileBrowserFilters,
  FileBrowserResult,
  FolderSummary,
  ImportantFile,
} from "@/lib/files/types";
import {
  compareFiles,
  getFileType,
  matchesSearch,
  normalizeFolderPath,
} from "@/lib/files/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const SNAPSHOT_LIMIT = 5001;
const FILE_SELECT = [
  "id",
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
].join(",");

async function getDataClient(): Promise<{
  client: SupabaseClient;
  accessMode: "service-role" | "session";
}> {
  const admin = createAdminClient();
  if (admin) return { client: admin, accessMode: "service-role" };

  return { client: await createSessionClient(), accessMode: "session" };
}

export async function getImportantFilesBrowser(
  filters: FileBrowserFilters,
): Promise<FileBrowserResult> {
  const { client, accessMode } = await getDataClient();
  const { data, error } = await client
    .from("important_files")
    .select(FILE_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);

  if (error) {
    throw new Error(
      accessMode === "session"
        ? `${error.message}. Add the server-only SUPABASE_SERVICE_ROLE_KEY environment variable, or configure authenticated read policies for important_files.`
        : error.message,
    );
  }

  const rawFiles = (data ?? []) as unknown as ImportantFile[];
  const truncated = rawFiles.length >= SNAPSHOT_LIMIT;
  const allFiles = rawFiles.slice(0, SNAPSHOT_LIMIT - 1).map((file) => ({
    ...file,
    folder_path: normalizeFolderPath(file.folder_path),
    file_size: Number(file.file_size) || 0,
    download_count: Number(file.download_count) || 0,
    is_favorite: Boolean(file.is_favorite),
  }));

  const categories = Array.from(
    new Set(
      allFiles
        .map((file) => String(file.category ?? "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const folders = buildChildFolders(allFiles, filters.folder, filters.q);
  const directFiles = filters.favorite
    ? allFiles
    : allFiles.filter((file) => normalizeFolderPath(file.folder_path) === filters.folder);

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
  };
}

export async function getImportantFileById(
  id: number,
): Promise<{ file: ImportantFile | null; accessMode: "service-role" | "session" }> {
  const { client, accessMode } = await getDataClient();
  const { data, error } = await client
    .from("important_files")
    .select(FILE_SELECT)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    file: data
      ? ({
          ...(data as unknown as ImportantFile),
          folder_path: normalizeFolderPath(
            (data as unknown as ImportantFile).folder_path,
          ),
          file_size: Number((data as unknown as ImportantFile).file_size) || 0,
          download_count:
            Number((data as unknown as ImportantFile).download_count) || 0,
          is_favorite: Boolean(
            (data as unknown as ImportantFile).is_favorite,
          ),
        } satisfies ImportantFile)
      : null,
    accessMode,
  };
}

function buildChildFolders(
  files: ImportantFile[],
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
        new Date(candidateDate).getTime() > new Date(existing.updatedAt).getTime())
    ) {
      existing.updatedAt = candidateDate;
    }

    folders.set(childPath, existing);
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
