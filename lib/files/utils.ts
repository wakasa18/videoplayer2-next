import type {
  FileBrowserFilters,
  FileSort,
  FileTypeFilter,
  ImportantFile,
} from "@/lib/files/types";

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);
const VIDEO_EXTENSIONS = new Set([
  "avi",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "webm",
]);
const AUDIO_EXTENSIONS = new Set([
  "aac",
  "flac",
  "m4a",
  "mp3",
  "ogg",
  "wav",
  "wma",
]);
const DOCUMENT_EXTENSIONS = new Set([
  "doc",
  "docx",
  "odt",
  "pages",
  "rtf",
]);
const SPREADSHEET_EXTENSIONS = new Set([
  "csv",
  "numbers",
  "ods",
  "xls",
  "xlsm",
  "xlsx",
]);
const PRESENTATION_EXTENSIONS = new Set([
  "key",
  "odp",
  "ppt",
  "pptx",
]);
const ARCHIVE_EXTENSIONS = new Set([
  "7z",
  "bz2",
  "gz",
  "rar",
  "tar",
  "tgz",
  "zip",
]);
const TEXT_EXTENSIONS = new Set([
  "css",
  "html",
  "ini",
  "java",
  "js",
  "json",
  "log",
  "md",
  "php",
  "py",
  "sql",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

export function normalizeFolderPath(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== "." && part !== "..")
    .join("/");
}

export function getFileExtension(file: ImportantFile): string {
  const storedExtension = String(file.file_extension ?? "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();

  if (storedExtension) return storedExtension;

  const filename = file.original_filename || file.title;
  const lastDot = filename.lastIndexOf(".");
  return lastDot > -1 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

export function getFileType(file: ImportantFile): Exclude<FileTypeFilter, ""> {
  const mime = String(file.mime_type ?? "").toLowerCase();
  const extension = getFileExtension(file);

  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (SPREADSHEET_EXTENSIONS.has(extension)) return "spreadsheet";
  if (PRESENTATION_EXTENSIONS.has(extension)) return "presentation";
  if (DOCUMENT_EXTENSIONS.has(extension)) return "document";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) return "text";
  return "other";
}

export function canPreviewFile(file: ImportantFile): boolean {
  return ["pdf", "image", "video", "audio", "text"].includes(getFileType(file));
}

export function formatBytes(bytes: number): string {
  const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safeBytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(safeBytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = safeBytes / 1024 ** index;
  const digits = index === 0 || value >= 10 ? 0 : 1;

  return `${value.toFixed(digits)} ${units[index]}`;
}

export function formatDate(value: string | null): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function parseFileBrowserFilters(
  params: Record<string, string | string[] | undefined>,
): FileBrowserFilters {
  const scalar = (key: string): string => {
    const value = params[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };

  const validTypes = new Set<FileTypeFilter>([
    "",
    "pdf",
    "image",
    "video",
    "audio",
    "document",
    "spreadsheet",
    "presentation",
    "archive",
    "text",
    "other",
  ]);
  const validSorts = new Set<FileSort>([
    "newest",
    "oldest",
    "name_asc",
    "name_desc",
    "size_asc",
    "size_desc",
  ]);
  const requestedType = scalar("type") as FileTypeFilter;
  const requestedSort = scalar("sort") as FileSort;
  const page = Math.max(1, Number.parseInt(scalar("page"), 10) || 1);
  const requestedPerPage = Number.parseInt(scalar("per_page"), 10) || 24;
  const perPage = [12, 24, 48, 96].includes(requestedPerPage)
    ? requestedPerPage
    : 24;

  return {
    folder: normalizeFolderPath(scalar("folder")),
    q: scalar("q").trim().slice(0, 200),
    type: validTypes.has(requestedType) ? requestedType : "",
    category: scalar("category").trim().slice(0, 100),
    favorite: scalar("favorite") === "1",
    sort: validSorts.has(requestedSort) ? requestedSort : "newest",
    view: scalar("view") === "list" ? "list" : "grid",
    page,
    perPage,
  };
}

export function buildFileQuery(
  filters: FileBrowserFilters,
  changes: Partial<Record<keyof FileBrowserFilters, string | number | boolean>> = {},
): string {
  const merged = { ...filters, ...changes };
  const params = new URLSearchParams();

  if (merged.folder) params.set("folder", String(merged.folder));
  if (merged.q) params.set("q", String(merged.q));
  if (merged.type) params.set("type", String(merged.type));
  if (merged.category) params.set("category", String(merged.category));
  if (merged.favorite) params.set("favorite", "1");
  if (merged.sort !== "newest") params.set("sort", String(merged.sort));
  if (merged.view !== "grid") params.set("view", String(merged.view));
  if (Number(merged.page) > 1) params.set("page", String(merged.page));
  if (Number(merged.perPage) !== 24)
    params.set("per_page", String(merged.perPage));

  const query = params.toString();
  return query ? `/dashboard/files?${query}` : "/dashboard/files";
}

export function matchesSearch(file: ImportantFile, query: string): boolean {
  if (!query) return true;
  const haystack = [
    file.title,
    file.original_filename,
    file.description,
    file.category,
    file.folder_path,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  return haystack.includes(query.toLocaleLowerCase());
}

export function compareFiles(a: ImportantFile, b: ImportantFile, sort: FileSort) {
  const dateA = new Date(a.created_at ?? 0).getTime() || 0;
  const dateB = new Date(b.created_at ?? 0).getTime() || 0;
  const titleCompare = a.title.localeCompare(b.title, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  switch (sort) {
    case "oldest":
      return dateA - dateB || a.id - b.id;
    case "name_asc":
      return titleCompare || a.id - b.id;
    case "name_desc":
      return -titleCompare || b.id - a.id;
    case "size_asc":
      return a.file_size - b.file_size || titleCompare;
    case "size_desc":
      return b.file_size - a.file_size || titleCompare;
    case "newest":
    default:
      return dateB - dateA || b.id - a.id;
  }
}
