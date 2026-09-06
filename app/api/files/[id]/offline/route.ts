import { NextResponse } from "next/server";

import { createAdminClient, getFilesBucket } from "@/lib/supabase/admin";
import { writeFileAudit } from "@/lib/files/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid file identifier." }, { status: 400 });

  const client = createAdminClient() ?? sessionClient;
  const { data: file, error: fileError } = await client
    .from("important_files")
    .select("id,file_path,original_filename,mime_type,file_size,status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });
  if (!file?.file_path) return NextResponse.json({ error: "File not found." }, { status: 404 });

  const { data, error } = await client.storage.from(getFilesBucket()).download(String(file.file_path));
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not prepare the offline file copy." }, { status: 500 });

  await writeFileAudit(client, "file_cached_offline", { user_id: user.id, size: Number(file.file_size ?? 0) }, id);
  const safeName = encodeURIComponent(String(file.original_filename || `file-${id}`));
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": String(file.mime_type || data.type || "application/octet-stream"),
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
