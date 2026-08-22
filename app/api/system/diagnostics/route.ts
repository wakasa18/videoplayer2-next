import { getSystemDiagnosticsData } from "@/lib/system/data";
import { systemErrorResponse } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getSystemDiagnosticsData();
    return Response.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return systemErrorResponse(error);
  }
}
