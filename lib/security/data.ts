import "server-only";

import { redirect } from "next/navigation";

import { APP_SESSION_COOKIE } from "@/lib/security/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type SecuritySession = {
  id: string;
  device_label: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  current: boolean;
};

export type LoginHistoryItem = {
  id: number;
  status: "success" | "failed" | "locked" | "signed_out" | "revoked";
  reason: string | null;
  device_label: string | null;
  created_at: string;
};

export async function getSecurityCenterData() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) redirect("/auth/login");
  const client = createAdminClient() ?? session;
  const currentId = (await cookies()).get(APP_SESSION_COOKIE)?.value ?? "";
  const [sessionsResult, historyResult] = await Promise.all([
    client
      .from("workspace_sessions")
      .select("id,device_label,created_at,last_seen_at,expires_at,revoked_at,revoke_reason")
      .eq("owner_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(50),
    client
      .from("workspace_login_history")
      .select("id,status,reason,device_label,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (sessionsResult.error) throw new Error(`${sessionsResult.error.message}. Run database/phase13_selected_features.sql.`);
  if (historyResult.error) throw new Error(`${historyResult.error.message}. Run database/phase13_selected_features.sql.`);
  return {
    currentSessionId: currentId,
    sessions: (sessionsResult.data ?? []).map((row) => ({
      ...row,
      id: String(row.id),
      current: String(row.id) === currentId,
    })) as SecuritySession[],
    history: (historyResult.data ?? []) as LoginHistoryItem[],
  };
}
