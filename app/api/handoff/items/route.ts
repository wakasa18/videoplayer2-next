import { collectHandoffData, updateHandoffItem } from "@/lib/handoff/server";
import type { HandoffItemStatus } from "@/lib/handoff/types";
import { requireSystemContext, safeErrorText, systemErrorResponse } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const payload = (await request.json()) as { key?: unknown; status?: unknown; evidence?: unknown };
    const key = safeErrorText(payload.key, 120);
    const status = payload.status as HandoffItemStatus;
    if (!key || !["pending", "pass", "fail"].includes(status)) {
      return Response.json({ error: "Invalid acceptance item update." }, { status: 400 });
    }
    await updateHandoffItem(client, user.id, key, status, safeErrorText(payload.evidence, 2000) || null);
    const data = await collectHandoffData(client, user.id);
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return systemErrorResponse(error);
  }
}
