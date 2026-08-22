export type VideoRecord = {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  filename: string;
  original_filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  duration_seconds: number | null;
  thumbnail_path: string | null;
  status: "pending" | "active" | "deleted" | "failed" | string;
  is_favorite: boolean;
  view_count: number;
  download_count: number;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  finalized_at: string | null;
  last_viewed_at: string | null;
};

export type VideoSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "size_desc"
  | "size_asc"
  | "most_viewed";

export type VideoView = "grid" | "list";

export type VideoFilters = {
  q: string;
  category: string;
  favorite: boolean;
  sort: VideoSort;
  view: VideoView;
  page: number;
  perPage: number;
};

export type VideoBrowserResult = {
  videos: VideoRecord[];
  categories: string[];
  totalVideos: number;
  totalPages: number;
  totalBytes: number;
  totalViews: number;
  page: number;
  perPage: number;
  truncated: boolean;
  accessMode: "service-role" | "session";
};
