import "server-only";

import { redirect } from "next/navigation";

import { collectMaintenanceReport } from "@/lib/maintenance/server";
import type {
  BackupVerification,
  MaintenanceDashboardData,
  MaintenanceRun,
} from "@/lib/maintenance/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getMaintenanceDashboardData(): Promise<MaintenanceDashboardData> {
  const sessionClient = await createClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) redirect("/auth/login");
  const client = createAdminClient() ?? sessionClient;

  const [current, runsResult, backupsResult] = await Promise.all([
    collectMaintenanceReport(client, user.id),
    client
      .from("maintenance_runs")
      .select("id,run_type,status,summary,report,started_at,completed_at,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    client
      .from("backup_verifications")
      .select("id,filename,schema_name,backup_version,status,counts,warnings,verified_at")
      .eq("owner_id", user.id)
      .order("verified_at", { ascending: false })
      .limit(8),
  ]);

  if (runsResult.error || backupsResult.error) {
    const detail = runsResult.error?.message ?? backupsResult.error?.message ?? "Phase 10 tables are unavailable.";
    throw new Error(`${detail} Run database/phase10_post_launch_maintenance.sql.`);
  }

  return {
    checkedAt: new Date().toISOString(),
    current,
    recentRuns: (runsResult.data ?? []) as MaintenanceRun[],
    backupVerifications: (backupsResult.data ?? []) as BackupVerification[],
  };
}
