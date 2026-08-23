import { requireSystemContext, safeErrorText, systemErrorResponse, SystemRequestError } from "@/lib/system/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Payload = {
  filename?: unknown;
  schema?: unknown;
  version?: unknown;
  generatedAt?: unknown;
  counts?: unknown;
  sections?: unknown;
  warnings?: unknown;
};

const REQUIRED_SECTIONS = ["important_files", "important_folders", "public_shares", "assignments", "videos"];

export async function POST(request: Request) {
  try {
    const { client, user } = await requireSystemContext(request);
    const body = (await request.json().catch(() => null)) as Payload | null;
    if (!body) throw new SystemRequestError("Invalid backup verification request.");
    const filename = safeErrorText(body.filename, 255);
    const schema = safeErrorText(body.schema, 160) || null;
    const version = Number(body.version);
    const sections = Array.isArray(body.sections) ? body.sections.map(String) : [];
    const counts = isRecord(body.counts) ? sanitizeCounts(body.counts) : {};
    const warnings = Array.isArray(body.warnings) ? body.warnings.map((item) => safeErrorText(item, 500)).filter(Boolean).slice(0, 30) : [];
    if (!filename) throw new SystemRequestError("Choose a backup file.");

    const missing = REQUIRED_SECTIONS.filter((section) => !sections.includes(section));
    const generatedAt = new Date(String(body.generatedAt ?? ""));
    if (!schema?.startsWith("damons-archive-")) warnings.push("The backup schema name is not recognized.");
    if (!Number.isFinite(version) || version < 1) warnings.push("The backup version is missing or invalid.");
    if (Number.isNaN(generatedAt.getTime())) warnings.push("The backup generation timestamp is invalid.");
    if (missing.length) warnings.push(`Missing required sections: ${missing.join(", ")}.`);
    const status = missing.length || !schema ? "fail" : warnings.length ? "warn" : "pass";

    const { data, error } = await client
      .from("backup_verifications")
      .insert({
        owner_id: user.id,
        filename,
        schema_name: schema,
        backup_version: Number.isFinite(version) ? Math.floor(version) : null,
        status,
        counts,
        warnings,
        verified_at: new Date().toISOString(),
      })
      .select("id,filename,schema_name,backup_version,status,counts,warnings,verified_at")
      .single();
    if (error) throw new SystemRequestError(`${error.message}. Run database/phase10_post_launch_maintenance.sql.`, 503);
    return Response.json({ success: true, verification: data });
  } catch (error) {
    return systemErrorResponse(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeCounts(value: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(value).slice(0, 40)) {
    const number = Number(count);
    if (Number.isFinite(number) && number >= 0) result[safeErrorText(key, 80)] = Math.floor(number);
  }
  return result;
}
