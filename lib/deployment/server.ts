import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  requireSystemContext,
  safeErrorText,
  SystemRequestError,
  systemErrorResponse,
} from "@/lib/system/server";

export class DeploymentRequestError extends SystemRequestError {
  constructor(message: string, status = 400) {
    super(message, status);
    this.name = "DeploymentRequestError";
  }
}

export async function requireDeploymentContext(request?: Request): Promise<{
  client: SupabaseClient;
  sessionClient: SupabaseClient;
  user: User;
  accessMode: "secret" | "session";
}> {
  return requireSystemContext(request);
}

export function deploymentErrorResponse(error: unknown): Response {
  return systemErrorResponse(error);
}

export function cleanDeploymentText(value: unknown, maxLength: number): string {
  return safeErrorText(value, maxLength);
}

export function assertUuid(value: unknown, label = "Release ID"): string {
  const normalized = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new DeploymentRequestError(`${label} is invalid.`);
  }
  return normalized;
}

export function normalizeDeploymentUrl(value: unknown): string | null {
  const raw = cleanDeploymentText(value, 1000);
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DeploymentRequestError("Deployment URL must be a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new DeploymentRequestError("Production deployment URLs must use HTTPS.");
  }
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export async function writeDeploymentEvent(
  client: SupabaseClient,
  ownerId: string,
  releaseId: string,
  eventType: string,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await client.from("deployment_events").insert({
    owner_id: ownerId,
    release_id: releaseId,
    event_type: cleanDeploymentText(eventType, 80) || "deployment_event",
    message: cleanDeploymentText(message, 2000) || "Deployment event",
    metadata,
  });
  if (error) throw new DeploymentRequestError(error.message, 500);
}
