import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AssignmentAnalytics,
  AssignmentAttachment,
  AssignmentBrowserResult,
  AssignmentCollectionResult,
  AssignmentDetails,
  AssignmentFilters,
  AssignmentItem,
  AssignmentNote,
  AssignmentSubject,
  AssignmentSubtask,
  AssignmentSummary,
} from "@/lib/assignments/types";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  addDays,
  calendarMonthBounds,
  compareAssignments,
  currentDateKey,
  isAssignmentCompleted,
  normalizePriority,
  normalizeStatus,
} from "@/lib/assignments/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const SNAPSHOT_LIMIT = 5001;
const CHILD_LIMIT = 20_000;

type DataContext = {
  client: SupabaseClient;
  userId: string;
  accessMode: "service-role" | "session";
};

type RawRow = Record<string, unknown>;

type RelatedData = {
  subjects: AssignmentSubject[];
  subtasks: AssignmentSubtask[];
  notes: AssignmentNote[];
  fileLinks: Array<{ assignment_id: number; important_file_id: number }>;
  files: AssignmentAttachment[];
  missingTables: string[];
};

async function getDataContext(): Promise<DataContext> {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) throw new Error("Authentication required.");

  const admin = createAdminClient();
  return {
    client: admin ?? sessionClient,
    userId: user.id,
    accessMode: admin ? "service-role" : "session",
  };
}

export async function getAssignmentsBrowser(
  filters: AssignmentFilters,
): Promise<AssignmentBrowserResult> {
  const { client, userId, accessMode } = await getDataContext();
  const { data, error } = await client
    .from("assignments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);

  if (error) {
    throw new Error(
      accessMode === "session"
        ? `${error.message}. Configure SUPABASE_SERVICE_ROLE_KEY or authenticated SELECT policies for the assignments tables.`
        : error.message,
    );
  }

  const allRows = (data ?? []) as RawRow[];
  const hasOwnerColumn = allRows.some((row) =>
    Object.prototype.hasOwnProperty.call(row, "owner_id"),
  );
  const rawRows = allRows.filter((row) =>
    hasOwnerColumn ? stringOrNull(row.owner_id) === userId : true,
  );
  const truncated = rawRows.length >= SNAPSHOT_LIMIT;
  const activeRows = rawRows
    .slice(0, SNAPSHOT_LIMIT - 1)
    .filter((row) => !stringOrNull(row.deleted_at) && !stringOrNull(row.archived_at));

  const related = await loadRelatedData(client, userId, activeRows);
  const items = hydrateAssignments(activeRows, related);
  const summary = buildSummary(items);
  const analytics = buildAnalytics(items);
  const filtered = applyFilters(items, filters);
  const totalResults = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / filters.perPage));
  const page = Math.min(filters.page, totalPages);

  let assignments: AssignmentItem[];
  if (filters.view === "list") {
    const start = (page - 1) * filters.perPage;
    assignments = filtered.slice(start, start + filters.perPage);
  } else if (filters.view === "calendar") {
    const bounds = calendarMonthBounds(filters.month);
    assignments = filtered
      .filter(
        (assignment) =>
          assignment.due_date &&
          assignment.due_date >= bounds.start &&
          assignment.due_date <= bounds.end,
      )
      .slice(0, 1000);
  } else {
    assignments = filtered.slice(0, 1000);
  }

  const legacySingleUserMode = !hasOwnerColumn;

  return {
    assignments,
    subjects: related.subjects.filter((subject) => !subject.is_archived),
    filters,
    summary,
    analytics,
    totalResults,
    totalPages,
    page,
    truncated,
    accessMode,
    legacySingleUserMode,
    optionalTablesMissing: related.missingTables,
  };
}

export async function getAssignmentDetails(id: number): Promise<AssignmentDetails | null> {
  const { client, userId } = await getDataContext();
  const { data, error } = await client
    .from("assignments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as RawRow;
  const hasOwnerColumn = Object.prototype.hasOwnProperty.call(row, "owner_id");
  const ownerId = stringOrNull(row.owner_id);
  if (hasOwnerColumn && ownerId !== userId) return null;
  if (stringOrNull(row.deleted_at) || stringOrNull(row.archived_at)) return null;

  const related = await loadRelatedData(client, userId, [row]);
  const assignment = hydrateAssignments([row], related)[0];
  if (!assignment) return null;

  const subject = assignment.subject_id
    ? related.subjects.find((item) => item.id === assignment.subject_id) ?? null
    : null;
  const attachmentIds = new Set(
    related.fileLinks
      .filter((link) => link.assignment_id === assignment.id)
      .map((link) => link.important_file_id),
  );

  return {
    assignment,
    subject,
    subtasks: related.subtasks
      .filter((item) => item.assignment_id === assignment.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    notes: related.notes
      .filter((item) => item.assignment_id === assignment.id)
      .sort(
        (a, b) =>
          Number(b.is_pinned) - Number(a.is_pinned) ||
          String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
      ),
    attachments: related.files.filter((file) => attachmentIds.has(file.id)),
  };
}


export async function getAssignmentCollection(
  mode: "archived" | "recycle",
): Promise<AssignmentCollectionResult> {
  const { client, userId, accessMode } = await getDataContext();
  const { data, error } = await client
    .from("assignments")
    .select("*")
    .order(mode === "recycle" ? "deleted_at" : "archived_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as RawRow[]).filter((row) => {
    const hasOwnerColumn = Object.prototype.hasOwnProperty.call(row, "owner_id");
    const ownerId = stringOrNull(row.owner_id);
    if (hasOwnerColumn && ownerId !== userId) return false;
    const deletedAt = stringOrNull(row.deleted_at);
    const archivedAt = stringOrNull(row.archived_at);
    return mode === "recycle" ? Boolean(deletedAt) : Boolean(archivedAt) && !deletedAt;
  });

  const related = await loadRelatedData(client, userId, rows);
  return {
    assignments: hydrateAssignments(rows, related),
    subjects: related.subjects,
    accessMode,
    optionalTablesMissing: related.missingTables,
  };
}

export async function getAssignmentSubjects(): Promise<AssignmentSubject[]> {
  const { client, userId } = await getDataContext();
  const missingTables: string[] = [];
  const rows = await safeSelect(
    client,
    "assignment_subjects",
    "id,owner_id,name,code,instructor,color,schedule,semester,is_archived",
    missingTables,
  );

  return rows
    .filter((row) => {
      const ownerId = stringOrNull(row.owner_id);
      return ownerId === userId && !booleanValue(row.is_archived);
    })
    .map(normalizeSubject)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

async function loadRelatedData(
  client: SupabaseClient,
  userId: string,
  assignmentRows: RawRow[],
): Promise<RelatedData> {
  const assignmentIds = assignmentRows
    .map((row) => numberValue(row.id))
    .filter((id) => id > 0);
  const subjectIds = Array.from(
    new Set(
      assignmentRows
        .map((row) => numberValue(row.subject_id))
        .filter((id) => id > 0),
    ),
  );
  const missingTables: string[] = [];

  const subjectsResult = await safeSelect(
    client,
    "assignment_subjects",
    "id,owner_id,name,code,instructor,color,schedule,semester,is_archived",
    missingTables,
  );
  const subjects = subjectsResult
    .filter((row) => {
      const ownerId = stringOrNull(row.owner_id);
      return ownerId === userId &&
        (subjectIds.length === 0 || subjectIds.includes(numberValue(row.id)) || !booleanValue(row.is_archived));
    })
    .map(normalizeSubject)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  if (assignmentIds.length === 0) {
    return { subjects, subtasks: [], notes: [], fileLinks: [], files: [], missingTables };
  }

  const [subtaskRows, noteRows, fileLinkRows] = await Promise.all([
    safeSelectByAssignmentIds(
      client,
      "assignment_subtasks",
      "id,assignment_id,title,is_done,sort_order,created_at,updated_at",
      assignmentIds,
      missingTables,
    ),
    safeSelectByAssignmentIds(
      client,
      "assignment_notes",
      "id,assignment_id,content,is_pinned,created_at,updated_at",
      assignmentIds,
      missingTables,
    ),
    safeSelectByAssignmentIds(
      client,
      "assignment_file_links",
      "assignment_id,important_file_id",
      assignmentIds,
      missingTables,
    ),
  ]);

  const subtasks = subtaskRows.map<AssignmentSubtask>((row) => ({
    id: numberValue(row.id),
    assignment_id: numberValue(row.assignment_id),
    title: stringValue(row.title),
    is_done: booleanValue(row.is_done),
    sort_order: numberValue(row.sort_order),
    created_at: stringOrNull(row.created_at),
    updated_at: stringOrNull(row.updated_at),
  }));
  const notes = noteRows.map<AssignmentNote>((row) => ({
    id: numberValue(row.id),
    assignment_id: numberValue(row.assignment_id),
    content: stringValue(row.content),
    is_pinned: booleanValue(row.is_pinned),
    created_at: stringOrNull(row.created_at),
    updated_at: stringOrNull(row.updated_at),
  }));
  const fileLinks = fileLinkRows.map((row) => ({
    assignment_id: numberValue(row.assignment_id),
    important_file_id: numberValue(row.important_file_id),
  }));
  const fileIds = Array.from(
    new Set(fileLinks.map((link) => link.important_file_id).filter((id) => id > 0)),
  );

  let files: AssignmentAttachment[] = [];
  if (fileIds.length > 0) {
    const { data, error } = await client
      .from("important_files")
      .select("id,owner_id,title,original_filename,mime_type,file_size,status")
      .in("id", fileIds)
      .limit(CHILD_LIMIT);
    if (!error) {
      files = ((data ?? []) as RawRow[])
        .filter((row) => {
          const ownerId = stringOrNull(row.owner_id);
          return ownerId === userId && stringValue(row.status, "active") === "active";
        })
        .map((row) => ({
          id: numberValue(row.id),
          title: stringValue(row.title),
          original_filename: stringValue(row.original_filename),
          mime_type: stringValue(row.mime_type, "application/octet-stream"),
          file_size: numberValue(row.file_size),
          status: stringValue(row.status, "active"),
        }));
    }
  }

  return { subjects, subtasks, notes, fileLinks, files, missingTables };
}

async function safeSelect(
  client: SupabaseClient,
  table: string,
  columns: string,
  missingTables: string[],
): Promise<RawRow[]> {
  const { data, error } = await client.from(table).select(columns).limit(CHILD_LIMIT);
  if (error) {
    if (isMissingTableOrColumn(error.message, error.code)) {
      if (!missingTables.includes(table)) missingTables.push(table);
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as RawRow[];
}

async function safeSelectByAssignmentIds(
  client: SupabaseClient,
  table: string,
  columns: string,
  assignmentIds: number[],
  missingTables: string[],
): Promise<RawRow[]> {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .in("assignment_id", assignmentIds)
    .limit(CHILD_LIMIT);
  if (error) {
    if (isMissingTableOrColumn(error.message, error.code)) {
      if (!missingTables.includes(table)) missingTables.push(table);
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as RawRow[];
}

function hydrateAssignments(rows: RawRow[], related: RelatedData): AssignmentItem[] {
  const subjectMap = new Map(related.subjects.map((subject) => [subject.id, subject]));
  const subtasksByAssignment = groupBy(related.subtasks, (item) => item.assignment_id);
  const notesByAssignment = groupBy(related.notes, (item) => item.assignment_id);
  const linksByAssignment = groupBy(related.fileLinks, (item) => item.assignment_id);
  const fileMap = new Map(related.files.map((file) => [file.id, file]));

  return rows.map((row) => {
    const id = numberValue(row.id);
    const subjectId = numberValue(row.subject_id) || null;
    const subject = subjectId ? subjectMap.get(subjectId) : null;
    const subtasks = subtasksByAssignment.get(id) ?? [];
    const notes = notesByAssignment.get(id) ?? [];
    const links = linksByAssignment.get(id) ?? [];
    const attachments = links
      .map((link) => fileMap.get(link.important_file_id))
      .filter((file): file is AssignmentAttachment => Boolean(file));
    const legacySubject = stringOrNull(row.subject);
    const subjectName = subject?.name || legacySubject || "General";
    const searchable = [
      stringValue(row.title),
      stringOrNull(row.description),
      subjectName,
      subject?.code,
      stringOrNull(row.link_url),
      stringOrNull(row.notes_log),
      ...subtasks.map((item) => item.title),
      ...notes.map((item) => item.content),
      ...attachments.flatMap((file) => [file.title, file.original_filename]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

    return {
      id,
      owner_id: stringOrNull(row.owner_id),
      title: stringValue(row.title, "Untitled assignment"),
      description: stringOrNull(row.description),
      due_date: dateOnly(row.due_date),
      due_time: timeOnly(row.due_time),
      status: normalizeStatus(row.status),
      priority: normalizePriority(row.priority),
      subject: legacySubject,
      subject_id: subjectId,
      subject_name: subjectName,
      subject_code: subject?.code ?? null,
      subject_color: normalizeColor(subject?.color),
      link_url: stringOrNull(row.link_url),
      recurrence: normalizeRecurrenceValue(row.recurrence),
      recurrence_series_id: stringOrNull(row.recurrence_series_id),
      recurrence_until: dateOnly(row.recurrence_until),
      occurrence_index: numberValue(row.occurrence_index),
      generated_from_id: numberValue(row.generated_from_id) || null,
      next_occurrence_id: numberValue(row.next_occurrence_id) || null,
      reminder_due_at: stringOrNull(row.reminder_due_at),
      reminder_sent_at: stringOrNull(row.reminder_sent_at),
      snoozed_until: stringOrNull(row.snoozed_until),
      notes_log: stringOrNull(row.notes_log),
      sort_order: numberValue(row.sort_order),
      completed_at: stringOrNull(row.completed_at),
      archived_at: stringOrNull(row.archived_at),
      deleted_at: stringOrNull(row.deleted_at),
      reminder_minutes_before: numberValue(row.reminder_minutes_before, 1440),
      custom_reminder_at: stringOrNull(row.custom_reminder_at),
      created_at: stringOrNull(row.created_at),
      updated_at: stringOrNull(row.updated_at),
      subtask_total: subtasks.length,
      subtask_done: subtasks.filter((item) => item.is_done).length,
      note_count: notes.length,
      attachment_count: attachments.length,
      search_text: searchable,
    };
  });
}

function applyFilters(items: AssignmentItem[], filters: AssignmentFilters): AssignmentItem[] {
  const today = currentDateKey();
  const weekEnd = addDays(today, 7);
  const query = filters.q.toLocaleLowerCase();

  return items
    .filter((item) => !query || item.search_text.includes(query))
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.priority || item.priority === filters.priority)
    .filter((item) => filters.subjectId <= 0 || item.subject_id === filters.subjectId)
    .filter((item) => {
      if (filters.tab === "today") {
        return item.due_date === today && ACTIVE_ASSIGNMENT_STATUSES.includes(item.status);
      }
      if (filters.tab === "upcoming") {
        return Boolean(
          item.due_date &&
            item.due_date > today &&
            item.due_date <= weekEnd &&
            ACTIVE_ASSIGNMENT_STATUSES.includes(item.status),
        );
      }
      if (filters.tab === "overdue") {
        return Boolean(
          item.due_date &&
            item.due_date < today &&
            ACTIVE_ASSIGNMENT_STATUSES.includes(item.status),
        );
      }
      if (filters.tab === "no_deadline") {
        return !item.due_date && ACTIVE_ASSIGNMENT_STATUSES.includes(item.status);
      }
      if (filters.tab === "completed") return isAssignmentCompleted(item.status);
      return true;
    })
    .sort((a, b) => compareAssignments(a, b, filters.sort));
}

function buildSummary(items: AssignmentItem[]): AssignmentSummary {
  const today = currentDateKey();
  const weekEnd = addDays(today, 7);
  return {
    all: items.length,
    today: items.filter(
      (item) => item.due_date === today && ACTIVE_ASSIGNMENT_STATUSES.includes(item.status),
    ).length,
    upcoming: items.filter(
      (item) =>
        item.due_date &&
        item.due_date > today &&
        item.due_date <= weekEnd &&
        ACTIVE_ASSIGNMENT_STATUSES.includes(item.status),
    ).length,
    overdue: items.filter(
      (item) =>
        item.due_date &&
        item.due_date < today &&
        ACTIVE_ASSIGNMENT_STATUSES.includes(item.status),
    ).length,
    noDeadline: items.filter(
      (item) => !item.due_date && ACTIVE_ASSIGNMENT_STATUSES.includes(item.status),
    ).length,
    completed: items.filter((item) => isAssignmentCompleted(item.status)).length,
    active: items.filter((item) => ACTIVE_ASSIGNMENT_STATUSES.includes(item.status)).length,
  };
}

function buildAnalytics(items: AssignmentItem[]): AssignmentAnalytics {
  const now = new Date();
  const philippinesNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  );
  const day = philippinesNow.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(philippinesNow);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + mondayOffset);
  const monthStart = new Date(philippinesNow.getFullYear(), philippinesNow.getMonth(), 1);
  const completed = items.filter((item) => item.completed_at);
  const completedWeek = completed.filter((item) => dateValue(item.completed_at) >= monday.getTime()).length;
  const completedMonth = completed.filter((item) => dateValue(item.completed_at) >= monthStart.getTime()).length;
  const completedWithDeadline = completed.filter((item) => item.due_date);
  const onTime = completedWithDeadline.filter((item) => {
    const due = Date.parse(`${item.due_date}T${item.due_time || "23:59"}:00+08:00`);
    return dateValue(item.completed_at) <= due;
  }).length;

  const workload = new Map<string, number>();
  items
    .filter((item) => ACTIVE_ASSIGNMENT_STATUSES.includes(item.status))
    .forEach((item) => workload.set(item.subject_name, (workload.get(item.subject_name) ?? 0) + 1));
  const topSubjectEntry = [...workload.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    completedWeek,
    completedMonth,
    onTimePercent: completedWithDeadline.length
      ? Math.round((onTime / completedWithDeadline.length) * 100)
      : 0,
    topSubject: topSubjectEntry?.[0] ?? "None",
    topSubjectCount: topSubjectEntry?.[1] ?? 0,
  };
}

function normalizeSubject(row: RawRow): AssignmentSubject {
  return {
    id: numberValue(row.id),
    owner_id: stringOrNull(row.owner_id),
    name: stringValue(row.name, "Unnamed subject"),
    code: stringOrNull(row.code),
    instructor: stringOrNull(row.instructor),
    color: normalizeColor(row.color),
    schedule: stringOrNull(row.schedule),
    semester: stringOrNull(row.semester),
    is_archived: booleanValue(row.is_archived),
  };
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const value = key(item);
    const group = map.get(value) ?? [];
    group.push(item);
    map.set(value, group);
  }
  return map;
}

function isMissingTableOrColumn(message: string, code?: string): boolean {
  return (
    code === "42P01" ||
    code === "42703" ||
    /does not exist|could not find the table|schema cache/i.test(message)
  );
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}
function stringOrNull(value: unknown): string | null {
  const text = stringValue(value).trim();
  return text ? text : null;
}
function numberValue(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}
function dateOnly(value: unknown): string | null {
  const text = stringOrNull(value);
  return text ? text.slice(0, 10) : null;
}
function timeOnly(value: unknown): string | null {
  const text = stringOrNull(value);
  return text ? text.slice(0, 5) : null;
}
function normalizeColor(value: unknown): string {
  const text = stringValue(value);
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#1a73e8";
}
function dateValue(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeRecurrenceValue(value: unknown): import("@/lib/assignments/types").AssignmentRecurrence | null {
  const text = stringOrNull(value);
  return text && ["daily", "weekdays", "weekly", "biweekly", "monthly"].includes(text)
    ? (text as import("@/lib/assignments/types").AssignmentRecurrence)
    : null;
}
