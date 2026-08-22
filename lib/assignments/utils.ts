import type {
  AssignmentFilters,
  AssignmentItem,
  AssignmentPriority,
  AssignmentRecurrence,
  AssignmentSort,
  AssignmentStatus,
  AssignmentTab,
  AssignmentView,
} from "@/lib/assignments/types";

export const ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "to_do",
  "in_progress",
  "blocked",
  "submitted",
  "done",
];
export const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "to_do",
  "in_progress",
  "blocked",
];
export const ASSIGNMENT_PRIORITIES: AssignmentPriority[] = [
  "low",
  "medium",
  "high",
];
export const ASSIGNMENT_RECURRENCES: AssignmentRecurrence[] = [
  "daily",
  "weekdays",
  "weekly",
  "biweekly",
  "monthly",
];
export const ASSIGNMENT_TABS: AssignmentTab[] = [
  "all",
  "today",
  "upcoming",
  "overdue",
  "no_deadline",
  "completed",
];
export const ASSIGNMENT_VIEWS: AssignmentView[] = ["list", "board", "calendar"];
export const ASSIGNMENT_SORTS: AssignmentSort[] = [
  "due",
  "priority",
  "newest",
  "oldest",
  "alpha",
  "subject",
];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function positiveInteger(value: string, fallback: number, max = 1000): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function normalizeStatus(value: unknown): AssignmentStatus {
  if (value === "pending") return "to_do";
  return ASSIGNMENT_STATUSES.includes(value as AssignmentStatus)
    ? (value as AssignmentStatus)
    : "to_do";
}

export function normalizePriority(value: unknown): AssignmentPriority {
  return ASSIGNMENT_PRIORITIES.includes(value as AssignmentPriority)
    ? (value as AssignmentPriority)
    : "medium";
}

export function currentDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function currentMonthKey(): string {
  return currentDateKey().slice(0, 7);
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function parseAssignmentFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AssignmentFilters {
  const viewValue = first(searchParams.view) as AssignmentView;
  const tabValue = first(searchParams.tab) as AssignmentTab;
  const statusValue = first(searchParams.status) as AssignmentStatus;
  const priorityValue = first(searchParams.priority) as AssignmentPriority;
  const sortValue = first(searchParams.sort) as AssignmentSort;
  const monthValue = first(searchParams.month);
  const perPage = [10, 20, 30, 50, 100].includes(
    positiveInteger(first(searchParams.per_page), 20, 100),
  )
    ? positiveInteger(first(searchParams.per_page), 20, 100)
    : 20;

  return {
    q: first(searchParams.q).trim().slice(0, 200),
    view: ASSIGNMENT_VIEWS.includes(viewValue) ? viewValue : "list",
    tab: ASSIGNMENT_TABS.includes(tabValue) ? tabValue : "all",
    status: ASSIGNMENT_STATUSES.includes(statusValue) ? statusValue : "",
    priority: ASSIGNMENT_PRIORITIES.includes(priorityValue)
      ? priorityValue
      : "",
    subjectId: positiveInteger(first(searchParams.subject_id), 0, 2_147_483_647),
    sort: ASSIGNMENT_SORTS.includes(sortValue) ? sortValue : "due",
    page: positiveInteger(first(searchParams.page), 1, 100_000),
    perPage,
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)
      ? monthValue
      : currentMonthKey(),
  };
}

export function buildAssignmentQuery(
  filters: AssignmentFilters,
  patch: Partial<AssignmentFilters>,
): string {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.view !== "list") params.set("view", merged.view);
  if (merged.tab !== "all") params.set("tab", merged.tab);
  if (merged.status) params.set("status", merged.status);
  if (merged.priority) params.set("priority", merged.priority);
  if (merged.subjectId > 0) params.set("subject_id", String(merged.subjectId));
  if (merged.sort !== "due") params.set("sort", merged.sort);
  if (merged.page > 1) params.set("page", String(merged.page));
  if (merged.perPage !== 20) params.set("per_page", String(merged.perPage));
  if (merged.view === "calendar" || patch.month) params.set("month", merged.month);
  const query = params.toString();
  return `/dashboard/assignments${query ? `?${query}` : ""}`;
}

export function statusLabel(status: AssignmentStatus): string {
  return {
    to_do: "To do",
    in_progress: "In progress",
    blocked: "Blocked",
    submitted: "Submitted",
    done: "Done",
  }[status];
}


export function recurrenceLabel(recurrence: AssignmentRecurrence | null): string {
  if (!recurrence) return "Does not repeat";
  return {
    daily: "Daily",
    weekdays: "Every weekday",
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
  }[recurrence];
}

export function priorityLabel(priority: AssignmentPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function isAssignmentCompleted(status: AssignmentStatus): boolean {
  return status === "submitted" || status === "done";
}

export function isAssignmentOverdue(assignment: AssignmentItem): boolean {
  return Boolean(
    assignment.due_date &&
      assignment.due_date < currentDateKey() &&
      !isAssignmentCompleted(assignment.status),
  );
}

export function formatAssignmentDue(
  dateKey: string | null,
  timeValue: string | null,
): string {
  if (!dateKey) return "No deadline";
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const formatted = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  }).format(date);
  if (!timeValue) return formatted;
  const [hour, minute] = timeValue.split(":").map(Number);
  const time = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
  return `${formatted}, ${time}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

export function compareAssignments(
  a: AssignmentItem,
  b: AssignmentItem,
  sort: AssignmentSort,
): number {
  if (sort === "priority") {
    const weight = { low: 1, medium: 2, high: 3 };
    return weight[b.priority] - weight[a.priority] || compareDue(a, b);
  }
  if (sort === "newest") return dateValue(b.created_at) - dateValue(a.created_at);
  if (sort === "oldest") return dateValue(a.created_at) - dateValue(b.created_at);
  if (sort === "alpha") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  if (sort === "subject") {
    return (
      a.subject_name.localeCompare(b.subject_name, undefined, { sensitivity: "base" }) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    );
  }
  return compareDue(a, b);
}

function compareDue(a: AssignmentItem, b: AssignmentItem): number {
  const completeDifference =
    Number(isAssignmentCompleted(a.status)) - Number(isAssignmentCompleted(b.status));
  if (completeDifference) return completeDifference;
  const aDue = a.due_date ? `${a.due_date}T${a.due_time || "23:59"}` : "9999-12-31T23:59";
  const bDue = b.due_date ? `${b.due_date}T${b.due_time || "23:59"}` : "9999-12-31T23:59";
  return aDue.localeCompare(bDue) || b.id - a.id;
}

function dateValue(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function calendarMonthBounds(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const endDay = new Date(year, monthNumber, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(endDay).padStart(2, "0")}`,
  };
}

export function adjacentMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
