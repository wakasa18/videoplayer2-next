import { NextResponse } from "next/server";

import {
  FileRequestError,
  hashUploadToken,
  requireFileWriteContext,
  writeFileAudit,
} from "@/lib/files/server";
import { getFilesBucket } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { client, user } = await requireFileWriteContext(request);
    const payload = (await request.json()) as { uploadToken?: unknown };
    const uploadToken = String(payload.uploadToken ?? "").trim();

    if (!/^[a-f0-9]{64}$/.test(uploadToken)) {
      throw new FileRequestError("The upload token is invalid.");
    }

    const tokenHash = hashUploadToken(uploadToken);
    const { data: file } = await client
      .from("important_files")
      .select("id,file_path,original_filename,status,owner_id")
      .eq("owner_id", user.id)
      .eq("upload_token_hash", tokenHash)
      .eq("status", "pending")
      .maybeSingle();

    if (!file?.id) {
      return NextResponse.json({ success: true });
    }

    if (file.file_path) {
      await client.storage
        .from(getFilesBucket())
        .remove([String(file.file_path)]);
    }

    const { error: deleteError } = await client
      .from("important_files")
      .delete()
      .eq("id", Number(file.id))
      .eq("owner_id", user.id)
      .eq("status", "pending");

    if (deleteError) {
      await client
        .from("important_files")
        .update({
          status: "failed",
          upload_token_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", Number(file.id))
        .eq("owner_id", user.id);
    }

    await writeFileAudit(
      client,
      "upload_cancelled",
      { name: file.original_filename, user_id: user.id },
      Number(file.id),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FileRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cancel upload." },
      { status: 500 },
    );
  }
}
