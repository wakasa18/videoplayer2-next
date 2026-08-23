import { createMaintenanceRun } from "@/lib/maintenance/server";
import { requireSystemContext, systemErrorResponse } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const result = await createMaintenanceRun(client, user.id, "cleanup", { cleanup: true });
    return Response.json({ success: true, ...result });
  } catch (error) {
    return systemErrorResponse(error);
  }
}
