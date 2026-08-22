import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export class WorkspaceRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "WorkspaceRequestError";
  }
}

export async function requireWorkspaceWriteContext(request: Request): Promise<{
  sessionClient: SupabaseClient;
  client: SupabaseClient;
  user: User;
  accessMode: "service-role" | "session";
}> {
  assertSameOrigin(request);
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) {
    throw new WorkspaceRequestError("Authentication required.", 401);
  }

  const admin = createAdminClient();
  return {
    sessionClient,
    client: admin ?? sessionClient,
    user,
    accessMode: admin ? "service-role" : "session",
  };
}

export function getWorkspaceQuotaBytes(): number {
  const raw = Number(process.env.WORKSPACE_STORAGE_QUOTA_BYTES);
  return Number.isSafeInteger(raw) && raw > 0
    ? raw
    : 10 * 1024 * 1024 * 1024;
}

export async function writeWorkspaceSecurityEvent(
  client: SupabaseClient,
  ownerId: string,
  eventType: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await client.from("workspace_security_events").insert({
      owner_id: ownerId,
      event_type: eventType.slice(0, 80),
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Security-event history is best-effort and never blocks the main action.
  }
}

export function workspaceErrorResponse(error: unknown): Response {
  const status = error instanceof WorkspaceRequestError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "The workspace action failed.";
  return Response.json({ error: message }, { status });
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new WorkspaceRequestError("Invalid request origin.", 403);
  }

  const expectedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  if (expectedHost && originHost !== expectedHost) {
    throw new WorkspaceRequestError(
      "Cross-site workspace actions are not allowed.",
      403,
    );
  }
}
