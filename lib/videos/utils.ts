import type { VideoFilters, VideoRecord, VideoSort, VideoView } from "@/lib/videos/types";

const SORTS = new Set<VideoSort>([
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "size_desc",
  "size_asc",
  "most_viewed",
]);
const VIEWS = new Set<VideoView>(["grid", "list"]);
const PAGE_SIZES = new Set([12, 24, 48, 96]);

export function parseVideoFilters(
  params: Record<string, string | string[] | undefined>,
): VideoFilters {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };
  const page = Number.parseInt(value("page"), 10);
  const perPage = Number.parseInt(value("per_page"), 10);
  const sort = value("sort") as VideoSort;
  const view = value("view") as VideoView;

  return {
    q: value("q").trim().slice(0, 200),
    category: value("category").trim().slice(0, 100),
    favorite: value("favorite") === "1",
    sort: SORTS.has(sort) ? sort : "newest",
    view: VIEWS.has(view) ? view : "grid",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    perPage: PAGE_SIZES.has(perPage) ? perPage : 24,
  };
}

export function buildVideoQuery(
  filters: VideoFilters,
  changes: Partial<VideoFilters>,
): string {
  const next = { ...filters, ...changes };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.category) query.set("category", next.category);
  if (next.favorite) query.set("favorite", "1");
  if (next.sort !== "newest") query.set("sort", next.sort);
  if (next.view !== "grid") query.set("view", next.view);
  if (next.page > 1) query.set("page", String(next.page));
  if (next.perPage !== 24) query.set("per_page", String(next.perPage));
  const value = query.toString();
  return value ? `/dashboard/videos?${value}` : "/dashboard/videos";
}

export function compareVideos(a: VideoRecord, b: VideoRecord, sort: VideoSort) {
  switch (sort) {
    case "oldest":
      return dateValue(a.created_at) - dateValue(b.created_at);
    case "name_asc":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "name_desc":
      return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
    case "size_asc":
      return a.file_size - b.file_size;
    case "size_desc":
      return b.file_size - a.file_size;
    case "most_viewed":
      return b.view_count - a.view_count || dateValue(b.created_at) - dateValue(a.created_at);
    default:
      return dateValue(b.created_at) - dateValue(a.created_at);
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return "Duration unavailable";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
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

export function titleFromFilename(filename: string): string {
  const clean = filename.trim().replace(/[\\/]+/g, "-");
  const dot = clean.lastIndexOf(".");
  return (dot > 0 ? clean.slice(0, dot) : clean).slice(0, 255) || "Untitled video";
}

export function extensionFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && dot < filename.length - 1
    ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16)
    : "";
}

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  qt: "video/quicktime",
  ogv: "video/ogg",
  ogg: "video/ogg",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
};

export function normalizeVideoMimeType(mimeType: string, filename: string): string {
  const normalized = String(mimeType || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const extensionMime = VIDEO_MIME_BY_EXTENSION[extensionFromFilename(filename)];

  if (!normalized || normalized === "application/octet-stream" || normalized === "binary/octet-stream") {
    return extensionMime || "video/mp4";
  }
  if (normalized.startsWith("video/")) return normalized;
  return extensionMime || normalized;
}

export function isVideoMimeType(mimeType: string, filename: string): boolean {
  const normalized = normalizeVideoMimeType(mimeType, filename);
  return normalized.startsWith("video/") || Boolean(VIDEO_MIME_BY_EXTENSION[extensionFromFilename(filename)]);
}

export function isLikelyBrowserPlayableVideo(mimeType: string, filename: string): boolean {
  return ["video/mp4", "video/webm", "video/ogg", "video/quicktime"].includes(
    normalizeVideoMimeType(mimeType, filename),
  );
}

function dateValue(value: string | null): number {
  if (!value) return 0;
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : date;
}
