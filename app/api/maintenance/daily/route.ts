import { runDailyMaintenanceForAllOwners } from "@/lib/maintenance/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized maintenance request." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "A Supabase server secret is required." }, { status: 503 });

  try {
    const result = await runDailyMaintenanceForAllOwners(admin);
    return Response.json({ success: true, timestamp: new Date().toISOString(), ...result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Daily maintenance failed." }, { status: 500 });
  }
}
