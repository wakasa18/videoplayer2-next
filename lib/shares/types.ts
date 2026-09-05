import type { ImportantFile } from "@/lib/files/types";

export type ShareType = "file" | "folder";

export type ImportantFileShare = {
  id: number;
  owner_id: string | null;
  share_type: ShareType;
  file_id: number | null;
  folder_path: string | null;
  token_hash: string;
  token_ciphertext: string | null;
  expires_at: string | null;
  max_downloads: number | null;
  allow_downloads: boolean;
  share_title: string | null;
  share_message: string | null;
  display_name: string | null;
  view_count: number;
  download_count: number;
  last_accessed_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  password_hash?: string | null;
  password_salt?: string | null;
  password_hint?: string | null;
  password_protected?: boolean;
};

export type ShareListItem = ImportantFileShare & {
  target_name: string;
  public_url: string | null;
  state: "active" | "expired" | "limit-reached" | "revoked";
};

export type ShareEvent = {
  id: number;
  share_id: number;
  file_id: number | null;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type PublicShareFile = Pick<
  ImportantFile,
  | "id"
  | "title"
  | "description"
  | "category"
  | "folder_path"
  | "original_filename"
  | "file_extension"
  | "mime_type"
  | "file_size"
  | "document_date"
  | "created_at"
  | "updated_at"
>;

export type PublicShareResult = {
  share: ImportantFileShare;
  targetName: string;
  rootFolder: string;
  currentFolder: string;
  breadcrumbs: Array<{ label: string; path: string }>;
  folders: Array<{
    name: string;
    path: string;
    fileCount: number;
    totalBytes: number;
  }>;
  files: PublicShareFile[];
  totalFiles: number;
  totalBytes: number;
  currentTotalFiles: number;
  currentTotalBytes: number;
  lastUpdatedAt: string | null;
};
