import { createAdminClient, getFilesBucket, getVideosBucket } from "@/lib/supabase/admin";
import { getCanonicalAppUrl } from "@/lib/system/env";
import { PHASE9_RELEASE } from "@/lib/system/release";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const base = {
    service: "Damon's Archive",
    release: PHASE9_RELEASE,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    canonicalUrl: getCanonicalAppUrl(),
  };

  if (!deep) {
    const configured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    );
    return Response.json(
      { ...base, status: configured ? "ok" : "misconfigured" },
      {
        status: configured ? 200 : 503,
        headers: healthHeaders(),
      },
    );
  }

  const secret = process.env.HEALTH_CHECK_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json(
      { ...base, status: "unauthorized" },
      { status: 401, headers: healthHeaders() },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      { ...base, status: "misconfigured", database: false, storage: false },
      { status: 503, headers: healthHeaders() },
    );
  }

  const [database, buckets] = await Promise.all([
    admin.from("workspace_profiles").select("owner_id", { head: true, count: "exact" }).limit(1),
    admin.storage.listBuckets(),
  ]);
  const bucketNames = new Set((buckets.data ?? []).map((bucket) => bucket.name));
  const storage =
    !buckets.error && bucketNames.has(getFilesBucket()) && bucketNames.has(getVideosBucket());
  const ok = !database.error && storage;

  return Response.json(
    {
      ...base,
      status: ok ? "ok" : "degraded",
      database: !database.error,
      storage,
    },
    { status: ok ? 200 : 503, headers: healthHeaders() },
  );
}

function healthHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
  };
}
