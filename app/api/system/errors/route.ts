import {
  requireSystemContext,
  safeErrorText,
  systemErrorResponse,
  SystemRequestError,
} from "@/lib/system/server";
import { consumeRateLimit, rateLimitValue } from "@/lib/maintenance/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const rateLimit = await consumeRateLimit(client, user.id, "system-error-report", rateLimitValue("SYSTEM_ERROR_RATE_LIMIT", 60), 3600);
    if (!rateLimit.allowed) throw new SystemRequestError(`Too many error reports. Try again in ${rateLimit.retryAfterSeconds} seconds.`, 429);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new SystemRequestError("Invalid error report.");

    const message = safeErrorText(body.message, 2000);
    if (!message) throw new SystemRequestError("The error message is required.");

    const row = {
      owner_id: user.id,
      source: safeErrorText(body.source || "client", 80) || "client",
      message,
      digest: safeErrorText(body.digest, 160) || null,
      stack: safeErrorText(body.stack, 12000) || null,
      path: safeErrorText(body.path, 1000) || null,
      request_id: safeErrorText(body.requestId, 160) || null,
      metadata:
        body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      created_at: new Date().toISOString(),
    };

    const duplicateCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let duplicateQuery = client
      .from("system_error_logs")
      .select("id")
      .eq("owner_id", user.id)
      .eq("source", row.source)
      .eq("message", row.message)
      .gte("created_at", duplicateCutoff)
      .limit(1);

    duplicateQuery = row.digest
      ? duplicateQuery.eq("digest", row.digest)
      : duplicateQuery.is("digest", null);
    duplicateQuery = row.path
      ? duplicateQuery.eq("path", row.path)
      : duplicateQuery.is("path", null);

    const { data: duplicate, error: duplicateError } =
      await duplicateQuery.maybeSingle();
    if (!duplicateError && duplicate) {
      return Response.json({ success: true, duplicate: true });
    }

    const { error } = await client.from("system_error_logs").insert(row);
    if (error) {
      throw new SystemRequestError(
        `${error.message}. Run database/phase8_production_readiness.sql.`,
        503,
      );
    }
    return Response.json({ success: true, duplicate: false }, { status: 201 });
  } catch (error) {
    return systemErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 90);

    let deleteQuery = client
      .from("system_error_logs")
      .delete({ count: "exact" })
      .eq("owner_id", user.id);
    if (scope !== "all") {
      deleteQuery = deleteQuery.lt("created_at", cutoff.toISOString());
    }
    const { error, count } = await deleteQuery;
    if (error) throw new SystemRequestError(error.message, 500);
    return Response.json({ success: true, deleted: count ?? 0 });
  } catch (error) {
    return systemErrorResponse(error);
  }
}
