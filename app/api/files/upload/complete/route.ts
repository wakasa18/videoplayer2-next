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
    const { data: file, error: fileError } = await client
      .from("important_files")
      .select("id,file_path,file_size,mime_type,original_filename,status,owner_id,replacement_of_id")
      .eq("owner_id", user.id)
      .eq("upload_token_hash", tokenHash)
      .eq("status", "pending")
      .maybeSingle();

    if (fileError) {
      throw new FileRequestError(fileError.message, 422);
    }
    if (!file?.id || !file.file_path) {
      throw new FileRequestError(
        "This pending upload has expired or was already finalized.",
        409,
      );
    }

    const fileId = Number(file.id);
    const storage = client.storage.from(getFilesBucket());
    const { data: info, error: infoError } = await storage.info(
      String(file.file_path),
    );

    if (infoError || !info) {
      await failUpload(client, user.id, fileId, String(file.file_path));
      throw new FileRequestError(
        infoError?.message ?? "The uploaded object was not found in storage.",
        422,
      );
    }

    const actualSize = Number(info.size ?? 0);
    const expectedSize = Number(file.file_size ?? 0);
    if (actualSize !== expectedSize) {
      await failUpload(client, user.id, fileId, String(file.file_path));
      throw new FileRequestError(
        "The uploaded file size did not match the prepared upload.",
        422,
      );
    }

    const timestamp = new Date().toISOString();
    const contentType = String(info.contentType ?? file.mime_type ?? "").slice(
      0,
      150,
    );
    const { error: updateError } = await client
      .from("important_files")
      .update({
        status: "active",
        mime_type: contentType || "application/octet-stream",
        upload_token_hash: null,
        finalized_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", fileId)
      .eq("owner_id", user.id)
      .eq("status", "pending");

    if (updateError) {
      await failUpload(client, user.id, fileId, String(file.file_path));
      throw new FileRequestError(updateError.message, 422);
    }

    if (file.replacement_of_id) {
      const recycledAt = new Date().toISOString();
      await client
        .from("important_files")
        .update({ status: "deleted", deleted_at: recycledAt, updated_at: recycledAt })
        .eq("id", Number(file.replacement_of_id))
        .eq("owner_id", user.id)
        .eq("status", "active");
      await writeFileAudit(client, "file_replaced", { user_id: user.id, replacement_file_id: fileId }, Number(file.replacement_of_id));
    }

    await writeFileAudit(
      client,
      "file_uploaded",
      {
        name: file.original_filename,
        size: actualSize,
        user_id: user.id,
      },
      fileId,
    );

    return NextResponse.json({
      success: true,
      fileId,
      name: file.original_filename,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function failUpload(
  client: Awaited<ReturnType<typeof requireFileWriteContext>>["client"],
  ownerId: string,
  fileId: number,
  objectPath: string,
) {
  await client.storage.from(getFilesBucket()).remove([objectPath]);
  await client
    .from("important_files")
    .update({
      status: "failed",
      upload_token_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileId)
    .eq("owner_id", ownerId);
}

function errorResponse(error: unknown) {
  if (error instanceof FileRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Could not finalize upload." },
    { status: 500 },
  );
}
