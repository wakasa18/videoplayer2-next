import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  sendAssignmentDigestEmail,
  sendAssignmentReminderEmail,
} from "@/lib/assignments/email";
import type {
  AssignmentRecurrence,
  AssignmentStatus,
} from "@/lib/assignments/types";
import { writeAssignmentAudit } from "@/lib/assignments/server";

const ACTIVE_STATUSES: AssignmentStatus[] = ["to_do", "in_progress", "blocked"];
const COMPLETE_STATUSES: AssignmentStatus[] = ["submitted", "done"];
const AUTOMATION_LIMIT = 2_000;

type AssignmentRow = Record<string, unknown> & {
  id: number;
  owner_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  status?: AssignmentStatus;
  priority?: string;
  subject_id?: number | null;
  subject?: string | null;
  link_url?: string | null;
  recurrence?: AssignmentRecurrence | null;
  recurrence_series_id?: string | null;
  recurrence_until?: string | null;
  occurrence_index?: number | null;
  next_occurrence_id?: number | null;
  reminder_minutes_before?: number | null;
  custom_reminder_at?: string | null;
  reminder_due_at?: string | null;
  reminder_sent_at?: string | null;
  snoozed_until?: string | null;
  template_id?: number | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

type NotificationPreferenceRow = {
  owner_id: string;
  in_app_enabled: boolean;
  browser_enabled: boolean;
  email_enabled: boolean;
  email_address: string | null;
  daily_digest_enabled: boolean;
  digest_time: string;
  timezone: string;
};

export type AssignmentAutomationResult = {
  remindersCreated: number;
  recurrencesCreated: number;
  emailsRequested: number;
  errors: string[];
};

export async function ensureNextOccurrence(
  client: SupabaseClient,
  assignmentId: number,
  ownerId: string,
): Promise<number | null> {
  const { data, error } = await client
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const assignment = data as AssignmentRow;
  if (
    !assignment.recurrence ||
    !assignment.due_date ||
    assignment.next_occurrence_id ||
    assignment.deleted_at ||
    !COMPLETE_STATUSES.includes(assignment.status ?? "to_do")
  ) {
    return assignment.next_occurrence_id ?? null;
  }

  const nextDate = advanceRecurrenceDate(assignment.due_date, assignment.recurrence);
  if (assignment.recurrence_until && nextDate > assignment.recurrence_until) return null;

  const seriesId = assignment.recurrence_series_id || crypto.randomUUID();
  const nextIndex = Number(assignment.occurrence_index ?? 0) + 1;

  const { data: existing } = await client
    .from("assignments")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("recurrence_series_id", seriesId)
    .eq("occurrence_index", nextIndex)
    .maybeSingle();

  if (existing?.id) {
    await client
      .from("assignments")
      .update({
        recurrence_series_id: seriesId,
        next_occurrence_id: existing.id,
        recurrence_last_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .eq("owner_id", ownerId);
    return Number(existing.id);
  }

  const now = new Date().toISOString();
  const nextRow = {
    owner_id: ownerId,
    title: assignment.title,
    description: assignment.description ?? null,
    due_date: nextDate,
    due_time: assignment.due_time ?? null,
    status: "to_do",
    priority: assignment.priority ?? "medium",
    subject_id: assignment.subject_id ?? null,
    subject: assignment.subject ?? null,
    link_url: assignment.link_url ?? null,
    recurrence: assignment.recurrence,
    recurrence_series_id: seriesId,
    recurrence_until: assignment.recurrence_until ?? null,
    occurrence_index: nextIndex,
    generated_from_id: assignmentId,
    next_occurrence_id: null,
    reminder_minutes_before: Number(assignment.reminder_minutes_before ?? 1440),
    custom_reminder_at: null,
    reminder_due_at: null,
    reminder_sent_at: null,
    snoozed_until: null,
    template_id: assignment.template_id ?? null,
    completed_at: null,
    archived_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error: insertError } = await client
    .from("assignments")
    .insert(nextRow)
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: duplicate } = await client
        .from("assignments")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("recurrence_series_id", seriesId)
        .eq("occurrence_index", nextIndex)
        .maybeSingle();
      if (duplicate?.id) {
        const duplicateId = Number(duplicate.id);
        await client
          .from("assignments")
          .update({
            recurrence_series_id: seriesId,
            next_occurrence_id: duplicateId,
            recurrence_last_generated_at: now,
            updated_at: now,
          })
          .eq("id", assignmentId)
          .eq("owner_id", ownerId);
        return duplicateId;
      }
    }
    throw new Error(insertError.message);
  }

  const nextId = Number(inserted.id);

  const [{ data: subtasks }, { data: fileLinks }] = await Promise.all([
    client
      .from("assignment_subtasks")
      .select("title,sort_order")
      .eq("assignment_id", assignmentId)
      .eq("owner_id", ownerId)
      .order("sort_order"),
    client
      .from("assignment_file_links")
      .select("important_file_id")
      .eq("assignment_id", assignmentId)
      .eq("owner_id", ownerId),
  ]);

  if (subtasks?.length) {
    await client.from("assignment_subtasks").insert(
      subtasks.map((subtask) => ({
        owner_id: ownerId,
        assignment_id: nextId,
        title: subtask.title,
        is_done: false,
        sort_order: subtask.sort_order ?? 0,
        created_at: now,
        updated_at: now,
      })),
    );
  }

  if (fileLinks?.length) {
    await client.from("assignment_file_links").insert(
      fileLinks.map((link) => ({
        owner_id: ownerId,
        assignment_id: nextId,
        important_file_id: link.important_file_id,
        created_at: now,
      })),
    );
  }

  await client
    .from("assignments")
    .update({
      recurrence_series_id: seriesId,
      next_occurrence_id: nextId,
      recurrence_last_generated_at: now,
      updated_at: now,
    })
    .eq("id", assignmentId)
    .eq("owner_id", ownerId);

  await writeAssignmentAudit(client, ownerId, nextId, "recurring_assignment_generated", {
    previous_assignment_id: assignmentId,
    recurrence: assignment.recurrence,
    due_date: nextDate,
  });

  await createNotification(client, {
    ownerId,
    assignmentId: nextId,
    eventType: "recurrence",
    title: "Next recurring assignment created",
    message: `${assignment.title} is scheduled for ${formatDate(nextDate)}.`,
    dedupeKey: `recurrence:${seriesId}:${nextIndex}`,
  });

  return nextId;
}

export async function processAssignmentAutomation(
  client: SupabaseClient,
  options: { ownerId?: string; source: "cron" | "manual" | "completion" },
): Promise<AssignmentAutomationResult> {
  const result: AssignmentAutomationResult = {
    remindersCreated: 0,
    recurrencesCreated: 0,
    emailsRequested: 0,
    errors: [],
  };
  const startedAt = new Date().toISOString();

  let recurringQuery = client
    .from("assignments")
    .select("id,owner_id")
    .in("status", COMPLETE_STATUSES)
    .not("recurrence", "is", null)
    .is("next_occurrence_id", null)
    .is("deleted_at", null)
    .limit(AUTOMATION_LIMIT);
  if (options.ownerId) recurringQuery = recurringQuery.eq("owner_id", options.ownerId);

  const { data: recurringRows, error: recurringError } = await recurringQuery;
  if (recurringError) result.errors.push(recurringError.message);

  for (const row of recurringRows ?? []) {
    try {
      const generated = await ensureNextOccurrence(client, Number(row.id), String(row.owner_id));
      if (generated) result.recurrencesCreated += 1;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Recurrence generation failed.");
    }
  }

  let reminderQuery = client
    .from("assignments")
    .select(
      "id,owner_id,title,description,due_date,due_time,status,priority,subject_id,subject,reminder_minutes_before,custom_reminder_at,reminder_due_at,reminder_sent_at,snoozed_until,archived_at,deleted_at",
    )
    .in("status", ACTIVE_STATUSES)
    .is("archived_at", null)
    .is("deleted_at", null)
    .limit(AUTOMATION_LIMIT);
  if (options.ownerId) reminderQuery = reminderQuery.eq("owner_id", options.ownerId);

  const { data: reminderRows, error: reminderError } = await reminderQuery;
  if (reminderError) result.errors.push(reminderError.message);

  const ownerIds = Array.from(new Set((reminderRows ?? []).map((row) => String(row.owner_id))));
  const preferences = await loadPreferences(client, ownerIds);
  const subjectLabels = await loadSubjectLabels(client, (reminderRows ?? []) as AssignmentRow[]);
  const now = new Date();

  for (const raw of reminderRows ?? []) {
    const assignment = raw as AssignmentRow;
    try {
      const reminderAt = calculateReminderInstant(assignment);
      if (!reminderAt || reminderAt.getTime() > now.getTime()) continue;

      const reminderKey = reminderAt.toISOString();
      const alreadySent = assignment.reminder_sent_at
        ? new Date(assignment.reminder_sent_at).getTime() >= reminderAt.getTime()
        : false;
      if (alreadySent) continue;

      const dueAt = assignmentDueInstant(assignment);
      const overdue = dueAt ? dueAt.getTime() < now.getTime() : false;
      const preference = preferences.get(assignment.owner_id);
      const message = dueAt
        ? overdue
          ? `${assignment.title} was due ${formatDateTime(dueAt)}.`
          : `${assignment.title} is due ${formatDateTime(dueAt)}.`
        : `Scheduled reminder for ${assignment.title}.`;

      const inAppEnabled = preference?.in_app_enabled !== false;
      const browserEnabled = Boolean(preference?.browser_enabled);
      const emailEnabled = Boolean(preference?.email_enabled && preference.email_address);
      if (!inAppEnabled && !browserEnabled && !emailEnabled) continue;

      const dedupeKey = `reminder:${assignment.id}:${reminderKey}`;
      const inserted = await createNotification(client, {
        ownerId: assignment.owner_id,
        assignmentId: assignment.id,
        eventType: overdue ? "overdue" : "reminder",
        title: overdue ? "Assignment overdue" : "Assignment reminder",
        message,
        dedupeKey,
      });
      if (inserted && inAppEnabled) result.remindersCreated += 1;

      let emailDelivered = !emailEnabled;
      let emailedAt: string | null = null;
      if (emailEnabled && preference?.email_address) {
        const previousEmail = await getNotificationEmailedAt(
          client,
          assignment.owner_id,
          dedupeKey,
        );
        if (previousEmail) {
          emailDelivered = true;
          emailedAt = previousEmail;
        } else {
          await markNotificationEmailAttempt(client, assignment.owner_id, dedupeKey);
          const emailResult = await sendAssignmentReminderEmail({
            email: preference.email_address,
            assignmentId: assignment.id,
            title: assignment.title,
            message,
            dueAt: dueAt?.toISOString() ?? null,
            reminderAt: reminderAt.toISOString(),
            description: assignment.description ?? null,
            subject: subjectLabels.get(Number(assignment.subject_id ?? 0)) ?? assignment.subject ?? null,
            priority: assignment.priority ?? null,
            status: assignment.status ?? null,
            ownerId: assignment.owner_id,
            overdue,
          });
          if (emailResult.ok) {
            emailedAt = now.toISOString();
            emailDelivered = true;
            result.emailsRequested += 1;
            await markNotificationEmailed(
              client,
              assignment.owner_id,
              dedupeKey,
              emailedAt,
            );
          } else {
            await markNotificationEmailFailed(client, assignment.owner_id, dedupeKey, emailResult.error ?? "Unknown email error.");
            result.errors.push(
              `Email reminder for "${assignment.title}" failed: ${emailResult.error ?? "Unknown email error."}`,
            );
          }
        }
      }

      const deliveryCompleted = emailDelivered;
      const { error: updateError } = await client
        .from("assignments")
        .update({
          reminder_due_at: reminderAt.toISOString(),
          ...(deliveryCompleted ? { reminder_sent_at: now.toISOString() } : {}),
          snoozed_until: null,
          updated_at: now.toISOString(),
        })
        .eq("id", assignment.id)
        .eq("owner_id", assignment.owner_id);
      if (updateError) throw new Error(updateError.message);
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Reminder processing failed.");
    }
  }

  await createDailyDigests(client, reminderRows ?? [], preferences, result);

  await client.from("assignment_automation_runs").insert({
    owner_id: options.ownerId ?? null,
    run_source: options.source,
    reminders_created: result.remindersCreated,
    recurrences_created: result.recurrencesCreated,
    emails_requested: result.emailsRequested,
    errors: result.errors,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return result;
}

export function advanceRecurrenceDate(
  dateKey: string,
  recurrence: AssignmentRecurrence,
): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (recurrence === "monthly") {
    const targetMonth = month; // zero-based target after adding one month
    const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    return toDateKey(new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))));
  }

  const days = recurrence === "daily" ? 1 : recurrence === "weekly" ? 7 : recurrence === "biweekly" ? 14 : 1;
  date.setUTCDate(date.getUTCDate() + days);
  if (recurrence === "weekdays") {
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
  }
  return toDateKey(date);
}

function calculateReminderInstant(assignment: AssignmentRow): Date | null {
  if (assignment.snoozed_until) {
    const snoozed = new Date(assignment.snoozed_until);
    if (!Number.isNaN(snoozed.getTime())) return snoozed;
  }
  if (assignment.custom_reminder_at) {
    const custom = new Date(assignment.custom_reminder_at);
    if (!Number.isNaN(custom.getTime())) return custom;
  }
  const dueAt = assignmentDueInstant(assignment);
  if (!dueAt) return null;
  return new Date(dueAt.getTime() - Number(assignment.reminder_minutes_before ?? 1440) * 60_000);
}

function assignmentDueInstant(assignment: AssignmentRow): Date | null {
  if (!assignment.due_date) return null;
  const time = assignment.due_time || "23:59";
  const date = new Date(`${assignment.due_date}T${time}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function createNotification(
  client: SupabaseClient,
  input: {
    ownerId: string;
    assignmentId: number | null;
    eventType: "reminder" | "overdue" | "recurrence" | "digest" | "system";
    title: string;
    message: string;
    dedupeKey: string;
  },
): Promise<boolean> {
  const { error } = await client.from("assignment_notifications").insert({
    owner_id: input.ownerId,
    assignment_id: input.assignmentId,
    event_type: input.eventType,
    title: input.title.slice(0, 255),
    message: input.message,
    dedupe_key: input.dedupeKey.slice(0, 255),
    created_at: new Date().toISOString(),
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

async function loadSubjectLabels(
  client: SupabaseClient,
  assignments: AssignmentRow[],
): Promise<Map<number, string>> {
  const subjectIds = Array.from(
    new Set(
      assignments
        .map((assignment) => Number(assignment.subject_id ?? 0))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
  if (subjectIds.length === 0) return new Map();

  const { data, error } = await client
    .from("assignment_subjects")
    .select("id,name,code")
    .in("id", subjectIds);
  if (error) return new Map();

  return new Map(
    (data ?? []).map((row) => {
      const name = String(row.name ?? "").trim();
      const code = String(row.code ?? "").trim();
      const label = code && name ? `${code} · ${name}` : code || name || "Subject";
      return [Number(row.id), label] as const;
    }),
  );
}

async function loadPreferences(
  client: SupabaseClient,
  ownerIds: string[],
): Promise<Map<string, NotificationPreferenceRow>> {
  if (ownerIds.length === 0) return new Map();
  const { data } = await client
    .from("assignment_notification_preferences")
    .select("*")
    .in("owner_id", ownerIds);
  return new Map(
    ((data ?? []) as NotificationPreferenceRow[]).map((preference) => [
      preference.owner_id,
      preference,
    ]),
  );
}

async function createDailyDigests(
  client: SupabaseClient,
  rows: Record<string, unknown>[],
  preferences: Map<string, NotificationPreferenceRow>,
  result: AssignmentAutomationResult,
): Promise<void> {
  const manilaNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  );
  const dateKey = `${manilaNow.getFullYear()}-${String(manilaNow.getMonth() + 1).padStart(2, "0")}-${String(manilaNow.getDate()).padStart(2, "0")}`;
  const grouped = new Map<string, AssignmentRow[]>();
  for (const row of rows as AssignmentRow[]) {
    const list = grouped.get(row.owner_id) ?? [];
    list.push(row);
    grouped.set(row.owner_id, list);
  }

  for (const [ownerId, assignments] of grouped) {
    const preference = preferences.get(ownerId);
    if (!preference?.daily_digest_enabled) continue;
    const [hour = 7, minute = 0] = String(preference.digest_time || "07:00")
      .split(":")
      .map(Number);
    const currentMinutes = manilaNow.getHours() * 60 + manilaNow.getMinutes();
    if (currentMinutes < hour * 60 + minute) continue;

    const dueToday = assignments.filter((assignment) => assignment.due_date === dateKey);
    const overdue = assignments.filter(
      (assignment) => assignment.due_date && assignment.due_date < dateKey,
    );
    if (dueToday.length === 0 && overdue.length === 0) continue;

    const emailEnabled = Boolean(preference.email_enabled && preference.email_address);
    const inAppEnabled = preference.in_app_enabled !== false;
    const browserEnabled = Boolean(preference.browser_enabled);
    if (!inAppEnabled && !browserEnabled && !emailEnabled) continue;

    const dedupeKey = `digest:${dateKey}`;
    try {
      const created = await createNotification(client, {
        ownerId,
        assignmentId: null,
        eventType: "digest",
        title: "Daily assignment summary",
        message: `${dueToday.length} due today · ${overdue.length} overdue.`,
        dedupeKey,
      });
      if (created && inAppEnabled) result.remindersCreated += 1;

      if (emailEnabled && preference.email_address) {
        const previousEmail = await getNotificationEmailedAt(client, ownerId, dedupeKey);
        if (!previousEmail) {
          await markNotificationEmailAttempt(client, ownerId, dedupeKey);
          const emailResult = await sendAssignmentDigestEmail({
            email: preference.email_address,
            ownerId,
            dateKey,
            dueToday: dueToday.map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              dueAt: assignmentDueInstant(assignment)?.toISOString() ?? null,
              overdue: false,
            })),
            overdue: overdue.map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              dueAt: assignmentDueInstant(assignment)?.toISOString() ?? null,
              overdue: true,
            })),
          });
          if (emailResult.ok) {
            result.emailsRequested += 1;
            await markNotificationEmailed(
              client,
              ownerId,
              dedupeKey,
              new Date().toISOString(),
            );
          } else {
            await markNotificationEmailFailed(client, ownerId, dedupeKey, emailResult.error ?? "Unknown email error.");
            result.errors.push(
              `Daily assignment email failed: ${emailResult.error ?? "Unknown email error."}`,
            );
          }
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Daily digest failed.");
    }
  }
}

async function getNotificationEmailedAt(
  client: SupabaseClient,
  ownerId: string,
  dedupeKey: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("assignment_notifications")
    .select("emailed_at,email_status")
    .eq("owner_id", ownerId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.emailed_at ? String(data.emailed_at) : null;
}

async function markNotificationEmailAttempt(
  client: SupabaseClient,
  ownerId: string,
  dedupeKey: string,
): Promise<void> {
  const { data } = await client
    .from("assignment_notifications")
    .select("email_attempts")
    .eq("owner_id", ownerId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  const attempts = Number(data?.email_attempts ?? 0) + 1;
  const { error } = await client
    .from("assignment_notifications")
    .update({ email_status: attempts > 1 ? "retrying" : "pending", email_attempts: attempts, email_error: null, email_last_attempt_at: new Date().toISOString() })
    .eq("owner_id", ownerId)
    .eq("dedupe_key", dedupeKey);
  if (error) throw new Error(error.message);
}

async function markNotificationEmailFailed(
  client: SupabaseClient,
  ownerId: string,
  dedupeKey: string,
  message: string,
): Promise<void> {
  const { error } = await client
    .from("assignment_notifications")
    .update({ email_status: "failed", email_error: message.slice(0, 2000), email_last_attempt_at: new Date().toISOString() })
    .eq("owner_id", ownerId)
    .eq("dedupe_key", dedupeKey);
  if (error) throw new Error(error.message);
}

async function markNotificationEmailed(
  client: SupabaseClient,
  ownerId: string,
  dedupeKey: string,
  emailedAt: string,
): Promise<void> {
  const { error } = await client
    .from("assignment_notifications")
    .update({ emailed_at: emailedAt, email_status: "sent", email_error: null, email_last_attempt_at: emailedAt })
    .eq("owner_id", ownerId)
    .eq("dedupe_key", dedupeKey);
  if (error) throw new Error(error.message);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(Date.UTC(year, month - 1, day, 4)));
}

function formatDateTime(date: Date | null): string {
  if (!date) return "the scheduled deadline";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}
