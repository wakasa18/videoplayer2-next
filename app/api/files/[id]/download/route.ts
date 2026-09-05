import { NextResponse } from "next/server";

import { createAdminClient, getFilesBucket } from "@/lib/supabase/admin";
import { writeFileAudit } from "@/lib/files/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid file identifier." }, { status: 400 });
  }

  const client = createAdminClient() ?? sessionClient;
  const { data: file, error: fileError } = await client
    .from("important_files")
    .select("id,file_path,original_filename,status,download_count")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (fileError) {
    return NextResponse.json({ error: fileError.message }, { status: 500 });
  }
  if (!file?.file_path) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const safeName = String(file.original_filename || `file-${id}`)
    .replace(/[\r\n\0]/g, "")
    .slice(0, 240);
  const { data, error } = await client.storage
    .from(getFilesBucket())
    .createSignedUrl(String(file.file_path), 300, { download: safeName });

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        error:
          error?.message ??
          "Could not create a private download URL. Configure SUPABASE_SERVICE_ROLE_KEY or an authenticated Storage read policy.",
      },
      { status: 500 },
    );
  }

  const accessedAt = new Date().toISOString();
  await client
    .from("important_files")
    .update({
      download_count: Number(file.download_count ?? 0) + 1,
      last_downloaded_at: accessedAt,
      last_opened_at: accessedAt,
    })
    .eq("id", id)
    .eq("owner_id", user.id);
  await writeFileAudit(client, "file_downloaded", { user_id: user.id }, id);

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
