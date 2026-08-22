import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import type {
  AssignmentPriority,
  AssignmentRecurrence,
  AssignmentStatus,
} from "@/lib/assignments/types";
import {
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_RECURRENCES,
  ASSIGNMENT_STATUSES,
} from "@/lib/assignments/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export class AssignmentRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AssignmentRequestError";
    this.status = status;
  }
}


export type OwnedAssignmentRow = {
  id?: number;
  title?: string | null;
  status?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
};

export type AssignmentWriteContext = {
  client: SupabaseClient;
  user: User;
  accessMode: "service-role" | "session";
};

export async function requireAssignmentWriteContext(
  request: Request,
): Promise<AssignmentWriteContext> {
  assertSameOrigin(request);

  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) {
    throw new AssignmentRequestError("Authentication required.", 401);
  }

  const admin = createAdminClient();
  return {
    client: admin ?? sessionClient,
    user,
    accessMode: admin ? "service-role" : "session",
  };
}

export function parseAssignmentId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new AssignmentRequestError("Invalid assignment identifier.");
  }
  return id;
}

export function sanitizeText(
  value: unknown,
  maxLength: number,
  fallback = "",
): string {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

export function sanitizeNullableText(
  value: unknown,
  maxLength: number,
): string | null {
  const text = sanitizeText(value, maxLength);
  return text || null;
}

export function sanitizeStatus(value: unknown): AssignmentStatus {
  if (!ASSIGNMENT_STATUSES.includes(value as AssignmentStatus)) {
    throw new AssignmentRequestError("Select a valid assignment status.");
  }
  return value as AssignmentStatus;
}

export function sanitizePriority(value: unknown): AssignmentPriority {
  if (!ASSIGNMENT_PRIORITIES.includes(value as AssignmentPriority)) {
    throw new AssignmentRequestError("Select a valid assignment priority.");
  }
  return value as AssignmentPriority;
}

export function sanitizeRecurrence(value: unknown): AssignmentRecurrence | null {
  const text = sanitizeText(value, 20);
  if (!text) return null;
  if (!ASSIGNMENT_RECURRENCES.includes(text as AssignmentRecurrence)) {
    throw new AssignmentRequestError("Select a valid recurrence schedule.");
  }
  return text as AssignmentRecurrence;
}

export function sanitizeRecurrenceUntil(value: unknown): string | null {
  return sanitizeDate(value);
}

export function sanitizeDate(value: unknown): string | null {
  const text = sanitizeText(value, 10);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AssignmentRequestError("The deadline date is invalid.");
  }
  return text;
}

export function sanitizeTime(value: unknown): string | null {
  const text = sanitizeText(value, 5);
  if (!text) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new AssignmentRequestError("The deadline time is invalid.");
  }
  return text;
}

export function sanitizeSubjectId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const id = Number.parseInt(String(value), 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new AssignmentRequestError("Select a valid subject.");
  }
  return id;
}

export function sanitizeReminderMinutes(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "1440"), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 43_200) {
    throw new AssignmentRequestError("Reminder time must be between 0 and 43,200 minutes.");
  }
  return parsed;
}

export function sanitizeDateTime(value: unknown): string | null {
  const text = sanitizeText(value, 40);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new AssignmentRequestError("The custom reminder date is invalid.");
  }
  return parsed.toISOString();
}

export function sanitizeExternalUrl(value: unknown): string | null {
  const text = sanitizeText(value, 500);
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new AssignmentRequestError("Enter a valid http or https link.");
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AssignmentRequestError("Only http and https links are allowed.");
  }
  return url.toString();
}

export function normalizeCompletedAt(
  status: AssignmentStatus,
  previous: string | null = null,
): string | null {
  if (status === "done" || status === "submitted") {
    return previous || new Date().toISOString();
  }
  return null;
}

export async function getOwnedAssignment(
  client: SupabaseClient,
  assignmentId: number,
  userId: string,
  columns = "*",
): Promise<OwnedAssignmentRow> {
  const { data, error } = await client
    .from("assignments")
    .select(columns)
    .eq("id", assignmentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw new AssignmentRequestError(error.message, 422);
  if (!data) throw new AssignmentRequestError("Assignment not found.", 404);
  return data as unknown as OwnedAssignmentRow;
}

export async function getOwnedSubjectName(
  client: SupabaseClient,
  subjectId: number | null,
  userId: string,
): Promise<string | null> {
  if (!subjectId) return null;
  const { data, error } = await client
    .from("assignment_subjects")
    .select("id,name")
    .eq("id", subjectId)
    .eq("owner_id", userId)
    .eq("is_archived", false)
    .maybeSingle();
  if (error) throw new AssignmentRequestError(error.message, 422);
  if (!data) throw new AssignmentRequestError("The selected subject is unavailable.", 409);
  return String(data.name);
}

export async function writeAssignmentAudit(
  client: SupabaseClient,
  ownerId: string,
  assignmentId: number | null,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await client.from("assignment_audits").insert({
      owner_id: ownerId,
      assignment_id: assignmentId,
      action: action.slice(0, 80),
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Auditing is best-effort and never blocks the main action.
  }
}

export function assignmentErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Assignment action failed.";
  const status = error instanceof AssignmentRequestError ? error.status : 500;
  return Response.json({ error: message }, { status });
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AssignmentRequestError("Invalid request origin.", 403);
  }

  const expectedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  if (expectedHost && originHost !== expectedHost) {
    throw new AssignmentRequestError("Cross-site assignment actions are not allowed.", 403);
  }
}
