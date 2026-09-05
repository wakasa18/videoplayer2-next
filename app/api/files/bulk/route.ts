import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureFolderHierarchy } from "@/lib/files/folders";
import { FileRequestError, requireFileWriteContext, sanitizeFolderPath, writeFileAudit } from "@/lib/files/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BulkPayload = {
  ids?: unknown;
  action?: unknown;
  folderPath?: unknown;
  favorite?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const { client, user } = await requireFileWriteContext(request);
    const payload = (await request.json()) as BulkPayload;
    const ids = Array.from(new Set(Array.isArray(payload.ids) ? payload.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [])).slice(0, 100);
    if (!ids.length) throw new FileRequestError("Select at least one file.");
    const action = String(payload.action ?? "");
    const now = new Date().toISOString();

    const { data: owned, error: readError } = await client
      .from("important_files")
      .select("id,folder_path,status,is_favorite")
      .eq("owner_id", user.id)
      .in("id", ids);
    if (readError) throw new FileRequestError(readError.message, 422);
    const activeIds = (owned ?? []).filter((row) => row.status === "active").map((row) => Number(row.id));
    if (!activeIds.length) throw new FileRequestError("None of the selected files are active.", 409);

    if (action === "favorite") {
      const favorite = Boolean(payload.favorite);
      const { error } = await client.from("important_files").update({ is_favorite: favorite, updated_at: now }).eq("owner_id", user.id).eq("status", "active").in("id", activeIds);
      if (error) throw new FileRequestError(error.message, 422);
      await Promise.all(activeIds.map((id) => writeFileAudit(client, favorite ? "file_favorited" : "file_unfavorited", { file_id: id, user_id: user.id, bulk: true }, id)));
      return NextResponse.json({ success: true, updated: activeIds.length });
    }

    if (action === "move") {
      const folderPath = sanitizeFolderPath(payload.folderPath);
      if (folderPath) await ensureFolderHierarchy(client, folderPath, user.id);
      const { error } = await client.from("important_files").update({ folder_path: folderPath || null, updated_at: now }).eq("owner_id", user.id).eq("status", "active").in("id", activeIds);
      if (error) throw new FileRequestError(error.message, 422);
      await Promise.all(activeIds.map((id) => writeFileAudit(client, "file_moved", { file_id: id, user_id: user.id, to: folderPath, bulk: true }, id)));
      return NextResponse.json({ success: true, updated: activeIds.length, folderPath });
    }

    if (action === "trash") {
      const batchId = randomUUID();
      const purgeAt = new Date(Date.now() + 30 * 86400_000).toISOString();
      const { error } = await client.from("important_files").update({ status: "deleted", deleted_at: now, purge_at: purgeAt, recycle_batch_id: batchId, updated_at: now }).eq("owner_id", user.id).eq("status", "active").in("id", activeIds);
      if (error) throw new FileRequestError(error.message, 422);
      await Promise.all(activeIds.map((id) => writeFileAudit(client, "file_recycled", { file_id: id, user_id: user.id, batch_id: batchId, bulk: true }, id)));
      return NextResponse.json({ success: true, updated: activeIds.length, batchId });
    }

    throw new FileRequestError("Unsupported bulk action.");
  } catch (error) {
    if (error instanceof FileRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bulk action failed." }, { status: 500 });
  }
}
