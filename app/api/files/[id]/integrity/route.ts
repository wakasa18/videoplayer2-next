import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { writeFileAudit } from "@/lib/files/server";
import { createAdminClient, getFilesBucket } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  const client = createAdminClient() ?? session;
  const { data: file, error } = await client
    .from("important_files")
    .select("id,file_path,checksum_sha256,original_filename")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) return NextResponse.json({ error: `${error.message}. Run Phase 13.` }, { status: 422 });
  if (!file?.file_path) return NextResponse.json({ error: "File not found." }, { status: 404 });

  const { data: blob, error: downloadError } = await client.storage.from(getFilesBucket()).download(String(file.file_path));
  if (downloadError || !blob) return NextResponse.json({ error: downloadError?.message || "Stored object could not be read." }, { status: 502 });

  const hash = createHash("sha256");
  const reader = blob.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }
  const checksum = hash.digest("hex");
  const baseline = file.checksum_sha256 ? String(file.checksum_sha256) : null;
  const match = baseline ? baseline === checksum : true;
  const now = new Date().toISOString();
  await client
    .from("important_files")
    .update({ checksum_sha256: baseline || checksum, checksum_verified_at: now })
    .eq("id", id)
    .eq("owner_id", user.id);
  await writeFileAudit(client, match ? "integrity_verified" : "integrity_mismatch", {
    user_id: user.id,
    checksum,
    baseline: baseline || checksum,
  }, id);
  return NextResponse.json({ success: true, match, checksum, baseline: baseline || checksum, initialized: !baseline, verifiedAt: now });
}
