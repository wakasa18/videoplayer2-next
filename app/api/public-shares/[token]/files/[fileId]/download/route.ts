import { NextResponse } from "next/server";

import { consumeShareDownload, resolvePublicFile } from "@/lib/shares/data";
import { recordShareEvent, shareErrorResponse } from "@/lib/shares/server";
import { getFilesBucket } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; fileId: string }> },
) {
  try {
    const { token, fileId: rawId } = await context.params;
    const fileId = Number.parseInt(rawId, 10);
    const { admin, share, file } = await resolvePublicFile(token, fileId, true);
    const safeName = file.original_filename
      .replace(/[\r\n\0]/g, "")
      .slice(0, 240);
    const { data, error } = await admin.storage
      .from(getFilesBucket())
      .createSignedUrl(file.file_path, 300, { download: safeName });
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Could not create the download URL.");
    }

    await consumeShareDownload(admin, share);
    await Promise.allSettled([
      admin
        .from("important_files")
        .update({
          download_count: file.download_count + 1,
          last_downloaded_at: new Date().toISOString(),
        })
        .eq("id", file.id)
        .eq("owner_id", file.owner_id),
      recordShareEvent(
        admin,
        share.id,
        "download",
        request,
        { filename: file.original_filename, bytes: file.file_size },
        file.id,
      ),
    ]);

    return NextResponse.redirect(data.signedUrl, {
      status: 307,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return shareErrorResponse(error);
  }
}
