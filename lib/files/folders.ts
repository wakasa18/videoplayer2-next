import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeFolderPath } from "@/lib/files/utils";
import { isMissingFolderTableError } from "@/lib/files/server";

export type FolderRow = {
  path: string;
  name: string;
  parent_path: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function ensureFolderHierarchy(
  client: SupabaseClient,
  folderPath: string,
  options: { tolerateMissingTable?: boolean } = {},
): Promise<boolean> {
  const normalized = normalizeFolderPath(folderPath);
  if (!normalized) return true;

  const parts = normalized.split("/");
  const now = new Date().toISOString();
  const rows: FolderRow[] = [];
  let current = "";

  for (const part of parts) {
    const parent = current || null;
    current = current ? `${current}/${part}` : part;
    rows.push({
      path: current,
      name: part,
      parent_path: parent,
      created_at: now,
      updated_at: now,
    });
  }

  const { error } = await client
    .from("important_folders")
    .upsert(rows, { onConflict: "path", ignoreDuplicates: true });

  if (!error) return true;
  if (options.tolerateMissingTable && isMissingFolderTableError(error)) {
    return false;
  }

  throw new Error(error.message);
}
