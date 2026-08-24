import "server-only";

import { redirect } from "next/navigation";

import { collectQualityReport, getQualityHistory } from "@/lib/quality/server";
import type { QualityPageData } from "@/lib/quality/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getQualityPageData(): Promise<QualityPageData> {
  const sessionClient = await createClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();
  if (error || !user) redirect("/auth/login");

  const client = createAdminClient() ?? sessionClient;
  const [report, historyResult] = await Promise.all([
    collectQualityReport(client, user.id),
    getQualityHistory(client, user.id),
  ]);

  return {
    report,
    history: historyResult.history,
    persistenceAvailable: !historyResult.error,
    persistenceMessage: historyResult.error,
  };
}
