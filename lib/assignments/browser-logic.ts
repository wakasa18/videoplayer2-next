import type { AssignmentAnalytics, AssignmentFilters, AssignmentItem, AssignmentSummary } from "./types";
import { ACTIVE_ASSIGNMENT_STATUSES, addDays, assignmentDeadline, compareAssignments, currentDateKey, isAssignmentCompleted, isAssignmentOverdue } from "./utils";

export function applyFilters(items: AssignmentItem[], filters: AssignmentFilters, now = new Date()): AssignmentItem[] {
  const today = currentDateKey(now);
  const weekEnd = addDays(today, 7);
  const query = filters.q.toLocaleLowerCase();
  return items.filter((item) => {
    if (query && !item.search_text.includes(query)) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.priority && item.priority !== filters.priority) return false;
    if (filters.subjectId > 0 && item.subject_id !== filters.subjectId) return false;
    const active = ACTIVE_ASSIGNMENT_STATUSES.includes(item.status);
    if (filters.tab === "today") return item.due_date === today && active;
    if (filters.tab === "upcoming") return Boolean(item.due_date && item.due_date > today && item.due_date <= weekEnd && active);
    if (filters.tab === "overdue") return isAssignmentOverdue(item, now);
    if (filters.tab === "no_deadline") return !item.due_date && active;
    if (filters.tab === "completed") return isAssignmentCompleted(item.status);
    return true;
  }).sort((a, b) => compareAssignments(a, b, filters.sort));
}

export function buildSummary(items: AssignmentItem[], now = new Date()): AssignmentSummary {
  const today = currentDateKey(now);
  const weekEnd = addDays(today, 7);
  const active = items.filter((item) => ACTIVE_ASSIGNMENT_STATUSES.includes(item.status));
  return {
    all: items.length,
    active: active.length,
    today: active.filter((item) => item.due_date === today).length,
    upcoming: active.filter((item) => item.due_date && item.due_date > today && item.due_date <= weekEnd).length,
    overdue: active.filter((item) => isAssignmentOverdue(item, now)).length,
    noDeadline: active.filter((item) => !item.due_date).length,
    completed: items.filter((item) => isAssignmentCompleted(item.status)).length,
  };
}

export function buildAnalytics(items: AssignmentItem[], now = new Date()): AssignmentAnalytics {
  const today = currentDateKey(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, weekday === 0 ? -6 : 1 - weekday);
  const weekStart = Date.parse(`${monday}T00:00:00+08:00`);
  const monthStart = Date.parse(`${today.slice(0, 7)}-01T00:00:00+08:00`);
  const completed = items.filter((item) => isAssignmentCompleted(item.status) && item.completed_at && dateValue(item.completed_at) <= now.getTime());
  const withDeadline = completed.filter((item) => item.due_date);
  const onTime = withDeadline.filter((item) => dateValue(item.completed_at) <= assignmentDeadline(item)!).length;
  const workload = new Map<string, number>();
  items.filter((item) => ACTIVE_ASSIGNMENT_STATUSES.includes(item.status)).forEach((item) => workload.set(item.subject_name, (workload.get(item.subject_name) ?? 0) + 1));
  const top = [...workload.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    completedWeek: completed.filter((item) => dateValue(item.completed_at) >= weekStart).length,
    completedMonth: completed.filter((item) => dateValue(item.completed_at) >= monthStart).length,
    onTimePercent: withDeadline.length ? Math.round(onTime / withDeadline.length * 100) : 0,
    topSubject: top?.[0] ?? "None",
    topSubjectCount: top?.[1] ?? 0,
  };
}

function dateValue(value: string | null): number {
  if (!value) return NaN;
  return Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
}
