import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { resolveVideoObject } from "@/lib/videos/storage";
import type { VideoBrowserResult, VideoFilters, VideoRecord } from "@/lib/videos/types";
import { compareVideos } from "@/lib/videos/utils";

const SNAPSHOT_LIMIT = 5001;
const VIDEO_SELECT = [
  "id",
  "owner_id",
  "title",
  "description",
  "category",
  "filename",
  "original_filename",
  "file_path",
  "mime_type",
  "file_size",
  "duration_seconds",
  "thumbnail_path",
  "status",
  "is_favorite",
  "view_count",
  "download_count",
  "created_at",
  "updated_at",
  "deleted_at",
  "finalized_at",
  "last_viewed_at",
].join(",");

async function getContext(): Promise<{
  client: SupabaseClient;
  userId: string;
  accessMode: "service-role" | "session";
}> {
  const session = await createSessionClient();
  const {
    data: { user },
    error,
  } = await session.auth.getUser();
  if (error || !user) throw new Error("Authentication required.");
  const admin = createAdminClient();
  return {
    client: admin ?? session,
    userId: user.id,
    accessMode: admin ? "service-role" : "session",
  };
}

export async function getVideoBrowser(filters: VideoFilters): Promise<VideoBrowserResult> {
  const { client, userId, accessMode } = await getContext();
  const { data, error } = await client
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("owner_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);
  if (error) {
    throw new Error(
      accessMode === "session"
        ? `${error.message}. Run database/phase6_videos.sql or configure authenticated owner policies for videos.`
        : error.message,
    );
  }

  const raw = ((data ?? []) as unknown as VideoRecord[]).map(normalizeVideo);
  const truncated = raw.length >= SNAPSHOT_LIMIT;
  const allVideos = raw.slice(0, SNAPSHOT_LIMIT - 1);
  const normalizedQuery = filters.q.toLocaleLowerCase();
  const filtered = allVideos
    .filter((video) => {
      if (!normalizedQuery) return true;
      return [
        video.title,
        video.description,
        video.category,
        video.original_filename,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(normalizedQuery));
    })
    .filter(
      (video) =>
        !filters.category ||
        String(video.category ?? "").toLocaleLowerCase() === filters.category.toLocaleLowerCase(),
    )
    .filter((video) => !filters.favorite || video.is_favorite)
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || compareVideos(a, b, filters.sort));

  const totalVideos = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalVideos / filters.perPage));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.perPage;
  const categories = Array.from(
    new Set(allVideos.map((video) => String(video.category ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return {
    videos: filtered.slice(start, start + filters.perPage),
    categories,
    totalVideos,
    totalPages,
    totalBytes: filtered.reduce((sum, video) => sum + video.file_size, 0),
    totalViews: filtered.reduce((sum, video) => sum + video.view_count, 0),
    page,
    perPage: filters.perPage,
    truncated,
    accessMode,
  };
}

export async function getVideoById(
  id: number,
  options: { includeDeleted?: boolean; checkStorage?: boolean } = {},
): Promise<{
  video: VideoRecord | null;
  accessMode: "service-role" | "session";
  storageAvailable: boolean | null;
}> {
  const { client, userId, accessMode } = await getContext();
  let query = client.from("videos").select(VIDEO_SELECT).eq("id", id).eq("owner_id", userId);
  query = options.includeDeleted
    ? query.in("status", ["active", "deleted"])
    : query.eq("status", "active");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  const video = data ? normalizeVideo(data as unknown as VideoRecord) : null;
  const resolved = options.checkStorage && video
    ? await resolveVideoObject(client, video, userId)
    : null;
  return {
    video,
    accessMode,
    storageAvailable: options.checkStorage ? Boolean(resolved) : null,
  };
}

export async function getVideosRecycleBin(): Promise<{
  videos: VideoRecord[];
  totalBytes: number;
  accessMode: "service-role" | "session";
}> {
  const { client, userId, accessMode } = await getContext();
  const { data, error } = await client
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("owner_id", userId)
    .eq("status", "deleted")
    .order("deleted_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);
  if (error) throw new Error(error.message);
  const videos = ((data ?? []) as unknown as VideoRecord[]).map(normalizeVideo);
  return {
    videos,
    totalBytes: videos.reduce((sum, video) => sum + video.file_size, 0),
    accessMode,
  };
}

function normalizeVideo(video: VideoRecord): VideoRecord {
  return {
    ...video,
    file_size: Number(video.file_size) || 0,
    duration_seconds: video.duration_seconds == null ? null : Number(video.duration_seconds) || null,
    is_favorite: Boolean(video.is_favorite),
    view_count: Number(video.view_count) || 0,
    download_count: Number(video.download_count) || 0,
  };
}
