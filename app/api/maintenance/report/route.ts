import { requireSystemContext, systemErrorResponse, SystemRequestError } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { client, user } = await requireSystemContext();
    const { data, error } = await client
      .from("maintenance_runs")
      .select("id,run_type,status,summary,report,started_at,completed_at,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new SystemRequestError(error.message, 500);
    if (!data) throw new SystemRequestError("Run maintenance before downloading a report.", 404);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify({ schema: "damons-archive-phase10-maintenance-report", exportedAt: new Date().toISOString(), run: data }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="damons-archive-maintenance-${date}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return systemErrorResponse(error);
  }
}
