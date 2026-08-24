import {
  clearQualityHistory,
  collectQualityReport,
  saveQualityRun,
} from "@/lib/quality/server";
import { requireSystemContext, systemErrorResponse } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const report = await collectQualityReport(client, user.id);
    const saved = await saveQualityRun(client, user.id, report);
    return Response.json(
      {
        report,
        persisted: !saved.error,
        runId: saved.id,
        persistenceError: saved.error,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return systemErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const result = await clearQualityHistory(client, user.id);
    if (result.error) {
      return Response.json({ error: result.error }, { status: 500, headers: noStoreHeaders() });
    }
    return Response.json({ deleted: result.deleted }, { headers: noStoreHeaders() });
  } catch (error) {
    return systemErrorResponse(error);
  }
}

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
  };
}
