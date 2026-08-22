export type ImportantFile = {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  folder_path: string | null;
  stored_filename?: string | null;
  original_filename: string;
  file_path?: string | null;
  file_extension: string | null;
  mime_type: string;
  file_size: number;
  status: string;
  document_date: string | null;
  expires_at: string | null;
  is_favorite: boolean;
  download_count: number;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  recycle_batch_id?: string | null;
};

export type ImportantFolder = {
  id?: number;
  owner_id?: string | null;
  path: string;
  name: string;
  parent_path: string | null;
  status?: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at?: string | null;
  recycle_batch_id?: string | null;
};

export type FolderSummary = {
  name: string;
  path: string;
  fileCount: number;
  totalBytes: number;
  updatedAt: string | null;
  deletedAt?: string | null;
  recycleBatchId?: string | null;
};

export type FileViewMode = "grid" | "list";
export type FileSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "size_asc"
  | "size_desc";

export type FileTypeFilter =
  | ""
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "text"
  | "other";

export type FileBrowserFilters = {
  folder: string;
  q: string;
  type: FileTypeFilter;
  category: string;
  favorite: boolean;
  sort: FileSort;
  view: FileViewMode;
  page: number;
  perPage: number;
};

export type FileBrowserResult = {
  files: ImportantFile[];
  folders: FolderSummary[];
  categories: string[];
  breadcrumbs: Array<{ label: string; path: string }>;
  totalFiles: number;
  totalPages: number;
  totalBytes: number;
  page: number;
  perPage: number;
  truncated: boolean;
  accessMode: "service-role" | "session";
  folderTableAvailable: boolean;
};

export type RecycleBinResult = {
  files: ImportantFile[];
  folders: FolderSummary[];
  totalBytes: number;
  accessMode: "service-role" | "session";
  folderTableAvailable: boolean;
};
