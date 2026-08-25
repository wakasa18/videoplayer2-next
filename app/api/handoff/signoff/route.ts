import { collectHandoffData, saveSignoff } from "@/lib/handoff/server";
import { requireSystemContext, safeErrorText, systemErrorResponse } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const payload = (await request.json()) as { acceptedBy?: unknown; notes?: unknown };
    const acceptedBy = safeErrorText(payload.acceptedBy, 160);
    if (!acceptedBy) return Response.json({ error: "Accepted by is required." }, { status: 400 });
    const data = await collectHandoffData(client, user.id);
    const id = await saveSignoff(client, user.id, data, acceptedBy, safeErrorText(payload.notes, 4000) || null);
    return Response.json({ id, data: await collectHandoffData(client, user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return systemErrorResponse(error);
  }
}
