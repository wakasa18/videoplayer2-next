import type { QualityMetric, WebVitalPayload } from "@/lib/quality/types";
import { safeErrorText, requireSystemContext, systemErrorResponse } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_METRICS = new Set<QualityMetric["name"]>(["CLS", "FCP", "INP", "LCP", "TTFB"]);

export async function POST(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const payload = (await request.json()) as Partial<WebVitalPayload>;
    const name = String(payload.name ?? "") as QualityMetric["name"];
    const value = Number(payload.value);
    const delta = Number(payload.delta ?? 0);
    const metricId = safeErrorText(payload.id, 160);

    if (!ALLOWED_METRICS.has(name) || !metricId || !Number.isFinite(value) || value < 0) {
      return Response.json({ error: "Invalid Web Vital payload." }, { status: 400 });
    }

    const rateLimit = await client.rpc("phase10_consume_rate_limit", {
      p_bucket_key: `quality-vitals-${user.id}`.slice(0, 120),
      p_limit: 120,
      p_window_seconds: 3600,
    });
    if (!rateLimit.error && rateLimit.data === false) {
      return Response.json({ error: "Too many performance reports." }, { status: 429 });
    }

    const rating =
      payload.rating === "good" ||
      payload.rating === "needs-improvement" ||
      payload.rating === "poor"
        ? payload.rating
        : "needs-improvement";

    const { error } = await client.from("quality_web_vitals").upsert(
      {
        owner_id: user.id,
        metric_id: metricId,
        name,
        value,
        delta: Number.isFinite(delta) ? delta : 0,
        rating,
        navigation_type: safeErrorText(payload.navigationType, 80) || null,
        path: normalizePath(payload.path),
        user_agent: safeErrorText(request.headers.get("user-agent"), 300) || null,
      },
      { onConflict: "owner_id,metric_id" },
    );

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return systemErrorResponse(error);
  }
}

function normalizePath(value: unknown): string | null {
  const text = safeErrorText(value, 500);
  if (!text || !text.startsWith("/") || text.startsWith("//")) return null;
  return text;
}
