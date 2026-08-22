import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export class SystemRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "SystemRequestError";
  }
}

export async function requireSystemContext(request?: Request): Promise<{
  client: SupabaseClient;
  sessionClient: SupabaseClient;
  user: User;
  accessMode: "secret" | "session";
}> {
  if (request) assertSameOrigin(request);

  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) throw new SystemRequestError("Authentication required.", 401);
  const admin = createAdminClient();
  return {
    client: admin ?? sessionClient,
    sessionClient,
    user,
    accessMode: admin ? "secret" : "session",
  };
}

export function systemErrorResponse(error: unknown): Response {
  const status = error instanceof SystemRequestError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "The system request could not be completed.";
  return Response.json({ error: message }, { status });
}

export function safeErrorText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new SystemRequestError("Invalid request origin.", 403);
  }

  const expectedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (expectedHost && originHost !== expectedHost) {
    throw new SystemRequestError("Cross-site system actions are not allowed.", 403);
  }
}
