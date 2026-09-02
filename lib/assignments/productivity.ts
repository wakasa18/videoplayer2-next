import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AssignmentNotification,
  AssignmentNotificationPreferences,
  AssignmentProductivityData,
  AssignmentProductivityStats,
  AssignmentRecurrence,
  AssignmentTemplate,
} from "@/lib/assignments/types";
import { getAssignmentEmailServiceStatus } from "@/lib/assignments/email";
import { normalizePriority } from "@/lib/assignments/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const DEFAULT_PREFERENCES: AssignmentNotificationPreferences = {
  in_app_enabled: true,
  browser_enabled: false,
  email_enabled: false,
  email_address: null,
  daily_digest_enabled: true,
  digest_time: "07:00",
  timezone: "Asia/Manila",
};

export async function getAssignmentProductivityData(): Promise<AssignmentProductivityData> {
  const { client, userId, userEmail } = await getProductivityContext();
  const [templates, notifications, preferences, assignments, runs] = await Promise.all([
    loadTemplates(client, userId),
    loadNotifications(client, userId, 50),
    loadPreferences(client, userId, userEmail),
    loadAssignments(client, userId),
    loadAutomationRuns(client, userId),
  ]);

  return {
    emailService: getAssignmentEmailServiceStatus(),
    templates,
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read_at).length,
    preferences,
    stats: buildProductivityStats(assignments),
    recentAutomationRuns: runs,
  };
}

export async function getAssignmentNotificationFeed(limit = 12): Promise<{
  notifications: AssignmentNotification[];
  unreadCount: number;
  preferences: AssignmentNotificationPreferences;
}> {
  const { client, userId, userEmail } = await getProductivityContext();
  const [notifications, preferences, unreadResult] = await Promise.all([
    loadNotifications(client, userId, Math.min(Math.max(limit, 1), 50)),
    loadPreferences(client, userId, userEmail),
    client
      .from("assignment_notifications")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("read_at", null),
  ]);
  if (!preferences.in_app_enabled) {
    return { notifications: [], unreadCount: 0, preferences };
  }
  return {
    notifications,
    unreadCount: unreadResult.count ?? notifications.filter((item) => !item.read_at).length,
    preferences,
  };
}

async function getProductivityContext(): Promise<{
  client: SupabaseClient;
  userId: string;
  userEmail: string | null;
}> {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();
  if (error || !user) throw new Error("Authentication required.");
  return {
    client: createAdminClient() ?? sessionClient,
    userId: user.id,
    userEmail: user.email ?? null,
  };
}

async function loadTemplates(
  client: SupabaseClient,
  userId: string,
): Promise<AssignmentTemplate[]> {
  const { data, error } = await client
    .from("assignment_templates")
    .select(
      "id,owner_id,name,title,description,priority,recurrence,subject_id,due_time,due_offset_days,reminder_minutes_before,link_url,is_archived,created_at,updated_at",
    )
    .eq("owner_id", userId)
    .eq("is_archived", false)
    .order("name")
    .limit(200);
  if (error) {
    if (error.code === "42P01" || error.code === "42703") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    owner_id: String(row.owner_id),
    name: String(row.name),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    priority: normalizePriority(row.priority),
    recurrence: normalizeRecurrence(row.recurrence),
    subject_id: row.subject_id ? Number(row.subject_id) : null,
    due_time: row.due_time ? String(row.due_time).slice(0, 5) : null,
    due_offset_days: Number(row.due_offset_days ?? 7),
    reminder_minutes_before: Number(row.reminder_minutes_before ?? 1440),
    link_url: row.link_url ? String(row.link_url) : null,
    is_archived: Boolean(row.is_archived),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));
}

async function loadNotifications(
  client: SupabaseClient,
  userId: string,
  limit: number,
): Promise<AssignmentNotification[]> {
  const { data, error } = await client
    .from("assignment_notifications")
    .select(
      "id,assignment_id,event_type,title,message,read_at,emailed_at,created_at,assignments(title,due_date,due_time)",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const assignment = Array.isArray(row.assignments)
      ? row.assignments[0]
      : row.assignments;
    return {
      id: Number(row.id),
      assignment_id: row.assignment_id ? Number(row.assignment_id) : null,
      event_type: row.event_type as AssignmentNotification["event_type"],
      title: String(row.title),
      message: String(row.message),
      read_at: row.read_at ? String(row.read_at) : null,
      emailed_at: row.emailed_at ? String(row.emailed_at) : null,
      created_at: String(row.created_at),
      assignment_title: assignment?.title ? String(assignment.title) : null,
      due_date: assignment?.due_date ? String(assignment.due_date) : null,
      due_time: assignment?.due_time ? String(assignment.due_time).slice(0, 5) : null,
    };
  });
}

async function loadPreferences(
  client: SupabaseClient,
  userId: string,
  defaultEmail: string | null,
): Promise<AssignmentNotificationPreferences> {
  const { data, error } = await client
    .from("assignment_notification_preferences")
    .select(
      "in_app_enabled,browser_enabled,email_enabled,email_address,daily_digest_enabled,digest_time,timezone",
    )
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return { ...DEFAULT_PREFERENCES, email_address: defaultEmail };
    throw new Error(error.message);
  }
  if (!data) return { ...DEFAULT_PREFERENCES, email_address: defaultEmail };
  return {
    in_app_enabled: Boolean(data.in_app_enabled),
    browser_enabled: Boolean(data.browser_enabled),
    email_enabled: Boolean(data.email_enabled),
    email_address: data.email_address ? String(data.email_address) : null,
    daily_digest_enabled: Boolean(data.daily_digest_enabled),
    digest_time: String(data.digest_time ?? "07:00").slice(0, 5),
    timezone: String(data.timezone ?? "Asia/Manila"),
  };
}

async function loadAssignments(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("assignments")
    .select(
      "id,status,due_date,due_time,recurrence,completed_at,created_at,reminder_sent_at,snoozed_until,archived_at,deleted_at",
    )
    .eq("owner_id", userId)
    .limit(5_000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadAutomationRuns(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("assignment_automation_runs")
    .select(
      "id,run_source,reminders_created,recurrences_created,emails_requested,started_at,finished_at",
    )
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .order("started_at", { ascending: false })
    .limit(8);
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    run_source: String(row.run_source),
    reminders_created: Number(row.reminders_created ?? 0),
    recurrences_created: Number(row.recurrences_created ?? 0),
    emails_requested: Number(row.emails_requested ?? 0),
    started_at: String(row.started_at),
    finished_at: row.finished_at ? String(row.finished_at) : null,
  }));
}

function buildProductivityStats(rows: Array<Record<string, unknown>>): AssignmentProductivityStats {
  const now = new Date();
  const today = manilaDateKey(now);
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const activeRows = rows.filter(
    (row) => !row.archived_at && !row.deleted_at && !["done", "submitted"].includes(String(row.status)),
  );
  const completed30 = rows.filter((row) => {
    const completed = row.completed_at ? new Date(String(row.completed_at)) : null;
    return completed && completed >= thirtyDaysAgo;
  });
  const created30 = rows.filter((row) => {
    const created = row.created_at ? new Date(String(row.created_at)) : null;
    return created && created >= thirtyDaysAgo;
  });
  const completionDays = new Set(
    rows
      .map((row) => (row.completed_at ? manilaDateKey(new Date(String(row.completed_at))) : null))
      .filter((value): value is string => Boolean(value)),
  );

  return {
    active: activeRows.length,
    recurring: activeRows.filter((row) => Boolean(row.recurrence)).length,
    overdue: activeRows.filter((row) => row.due_date && String(row.due_date) < today).length,
    dueNext24Hours: activeRows.filter((row) => {
      const due = assignmentDueInstant(row);
      return due && due >= now && due <= in24Hours;
    }).length,
    remindersReady: activeRows.filter((row) => !row.reminder_sent_at && Boolean(row.due_date)).length,
    completed7Days: rows.filter((row) => {
      const completed = row.completed_at ? new Date(String(row.completed_at)) : null;
      return completed && completed >= sevenDaysAgo;
    }).length,
    completed30Days: completed30.length,
    completionRate30Days: created30.length
      ? Math.min(100, Math.round((completed30.length / created30.length) * 100))
      : 0,
    currentStreak: calculateStreak(completionDays, today),
  };
}

function assignmentDueInstant(row: Record<string, unknown>): Date | null {
  if (!row.due_date) return null;
  const date = new Date(`${row.due_date}T${row.due_time || "23:59"}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateStreak(days: Set<string>, today: string): number {
  let cursor = today;
  let streak = 0;
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function addDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function manilaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function normalizeRecurrence(value: unknown): AssignmentRecurrence | null {
  return ["daily", "weekdays", "weekly", "biweekly", "monthly"].includes(String(value))
    ? (String(value) as AssignmentRecurrence)
    : null;
}
