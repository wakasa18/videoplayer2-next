import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { APP_SESSION_COOKIE } from "@/lib/security/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const sessionId = (await cookies()).get(APP_SESSION_COOKIE)?.value;
  if (!sessionId) return NextResponse.json({ active: true, tracked: false });
  const client = createAdminClient() ?? session;
  const { data } = await client
    .from("workspace_sessions")
    .select("revoked_at,expires_at")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) {
    await session.auth.signOut();
    (await cookies()).delete(APP_SESSION_COOKIE);
    return NextResponse.json({ active: false }, { status: 401 });
  }
  await client
    .from("workspace_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("owner_id", user.id);
  return NextResponse.json({ active: true, tracked: true });
}
