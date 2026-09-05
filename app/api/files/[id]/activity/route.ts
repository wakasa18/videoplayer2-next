import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeFileAudit } from "@/lib/files/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  const client = createAdminClient() ?? session;
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("important_files")
    .update({ last_opened_at: now })
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  if (!data) return NextResponse.json({ error: "File not found." }, { status: 404 });
  await writeFileAudit(client, "file_opened", { user_id: user.id }, id);
  return NextResponse.json({ success: true });
}
