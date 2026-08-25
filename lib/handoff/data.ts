import "server-only";

import { redirect } from "next/navigation";

import { collectHandoffData } from "@/lib/handoff/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getHandoffPageData() {
  const sessionClient = await createClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) redirect("/auth/login");
  return collectHandoffData(createAdminClient() ?? sessionClient, user.id);
}
