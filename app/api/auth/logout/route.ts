import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { APP_SESSION_COOKIE, markSessionRevoked } from "@/lib/security/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(APP_SESSION_COOKIE)?.value;
  const admin = createAdminClient();
  if (user && sessionId && admin) {
    await markSessionRevoked(admin, user.id, sessionId, "Signed out by user");
    await admin.from("workspace_login_history").insert({
      owner_id: user.id,
      email_hash: "0".repeat(64),
      ip_hash: "0".repeat(64),
      status: "signed_out",
      reason: "Signed out by user",
      user_agent: null,
      device_label: null,
    });
  }
  await session.auth.signOut();
  cookieStore.delete(APP_SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
