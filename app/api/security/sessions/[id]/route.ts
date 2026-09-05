import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { APP_SESSION_COOKIE, markSessionRevoked } from "@/lib/security/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = (await context.params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  const client = createAdminClient() ?? session;
  await markSessionRevoked(client, user.id, id, "Revoked from security center");
  await client.from("workspace_login_history").insert({
    owner_id: user.id,
    email_hash: "0".repeat(64),
    ip_hash: "0".repeat(64),
    status: "revoked",
    reason: "Session revoked from security center",
  });
  const current = (await cookies()).get(APP_SESSION_COOKIE)?.value;
  if (current === id) {
    await session.auth.signOut();
    (await cookies()).delete(APP_SESSION_COOKIE);
  }
  return NextResponse.json({ success: true, current: current === id });
}
