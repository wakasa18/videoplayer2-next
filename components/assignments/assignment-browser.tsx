"use client";

import {
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Columns3,
  Filter,
  Loader2,
  Plus,
  List,
  Search,
  SearchX,
  Settings2,
  Sparkles,
  BellRing,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AssignmentBoard } from "@/components/assignments/assignment-board";
import { AssignmentEditorDialog } from "@/components/assignments/assignment-editor-dialog";
import { AssignmentCalendar } from "@/components/assignments/assignment-calendar";
import { AssignmentCard } from "@/components/assignments/assignment-card";
import { SubjectManagerDialog } from "@/components/assignments/subject-manager-dialog";
import type {
  AssignmentBrowserResult,
  AssignmentTab,
  AssignmentView,
} from "@/lib/assignments/types";
import {
  buildAssignmentQuery,
  priorityLabel,
  statusLabel,
} from "@/lib/assignments/utils";

const tabConfig: Array<{
  value: AssignmentTab;
  label: string;
  key: keyof AssignmentBrowserResult["summary"];
}> = [
  { value: "all", label: "All", key: "all" },
  { value: "today", label: "Today", key: "today" },
  { value: "upcoming", label: "Upcoming", key: "upcoming" },
  { value: "overdue", label: "Overdue", key: "overdue" },
  { value: "no_deadline", label: "No deadline", key: "noDeadline" },
  { value: "completed", label: "Completed", key: "completed" },
];

const viewConfig: Array<{
  value: AssignmentView;
  label: string;
  icon: typeof List;
}> = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
];

export function AssignmentBrowser({ result }: { result: AssignmentBrowserResult }) {
  const router = useRouter();
  const { filters } = result;
  const [creating, setCreating] = useState(false);
  const [managingSubjects, setManagingSubjects] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const filtered = Boolean(
    filters.q ||
      filters.tab !== "all" ||
      filters.status ||
      filters.priority ||
      filters.subjectId,
  );

  async function runBulk(action: string, status?: string) {
    if (bulkBusy || selectedIds.length === 0) return;
    if (action === "trash" && !window.confirm(`Move ${selectedIds.length} assignments to the Recycle Bin?`)) return;
    setBulkBusy(true);
    try {
      const response = await fetch("/api/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The selected assignments could not be updated.");
      setSelectedIds([]);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The selected assignments could not be updated.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
              <Sparkles className="size-4" aria-hidden="true" />
              Phase 5C · Smart assignment workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-[-.04em] text-slate-100 sm:text-4xl">
              Assignments
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Create and organize assignments with recurring schedules, reusable templates, reminder notifications, subtasks, notes, subjects, and linked files.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110"><Plus className="size-4" />New assignment</button>
              <button type="button" onClick={() => setManagingSubjects(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"><Settings2 className="size-4" />Subjects</button>
              <Link href="/dashboard/assignments/productivity" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/20 bg-white/[0.04] px-5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10"><BellRing className="size-4" />Productivity</Link>
              <Link href="/dashboard/assignments/archive" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"><Archive className="size-4" />Archive</Link>
              <Link href="/dashboard/assignments/recycle" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"><Trash2 className="size-4" />Recycle Bin</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            <Metric label="Active" value={result.summary.active} icon={Clock3} tone="blue" />
            <Metric label="Due today" value={result.summary.today} icon={CalendarDays} tone="amber" />
            <Metric label="Overdue" value={result.summary.overdue} icon={CircleAlert} tone="red" />
            <Metric label="Completed" value={result.summary.completed} icon={CheckCircle2} tone="green" />
          </div>
        </div>
      </motion.section>

      {result.legacySingleUserMode ? (
        <Notice>
          The existing assignments table does not have an <code>owner_id</code> column.
          Run the Phase 5B SQL migration before using create, edit, archive, or delete actions.
        </Notice>
      ) : null}

      {result.optionalTablesMissing.length > 0 ? (
        <Notice>
          Some optional assignment tables are missing: {result.optionalTablesMissing.join(", ")}.
          Run the existing <code>assignments_complete_upgrade.sql</code> to enable subjects,
          subtasks, structured notes, and linked files.
        </Notice>
      ) : null}

      {result.truncated ? (
        <Notice>
          The page loaded the first 5,000 assignment records. Database-side pagination
          will replace this snapshot in a later optimization phase.
        </Notice>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4 shadow-sm sm:p-5"
      >
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabConfig.map((tab) => {
            const active = filters.tab === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildAssignmentQuery(filters, { tab: tab.value, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-cyan-400/10 text-cyan-300"
                    : "text-slate-400 hover:bg-white/[0.06]"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    active ? "bg-white/80" : "bg-white/[0.05]"
                  }`}
                >
                  {result.summary[tab.key]}
                </span>
              </Link>
            );
          })}
        </div>

        <form
          action="/dashboard/assignments"
          method="get"
          className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(4,minmax(135px,.7fr))_auto]"
        >
          <input type="hidden" name="view" value={filters.view} />
          <input type="hidden" name="tab" value={filters.tab} />
          {filters.view === "calendar" ? (
            <input type="hidden" name="month" value={filters.month} />
          ) : null}

          <label className="relative block">
            <span className="sr-only">Search assignments</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search assignments, notes, subtasks…"
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.045] pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15"
            />
          </label>

          <Select name="status" label="Status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {(["to_do", "in_progress", "blocked", "submitted", "done"] as const).map(
              (status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ),
            )}
          </Select>

          <Select name="priority" label="Priority" defaultValue={filters.priority}>
            <option value="">All priorities</option>
            {(["low", "medium", "high"] as const).map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabel(priority)}
              </option>
            ))}
          </Select>

          <Select
            name="subject_id"
            label="Subject"
            defaultValue={filters.subjectId > 0 ? String(filters.subjectId) : ""}
          >
            <option value="">All subjects</option>
            {result.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code ? `${subject.code} · ` : ""}
                {subject.name}
              </option>
            ))}
          </Select>

          <Select name="sort" label="Sort" defaultValue={filters.sort}>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alpha">Title</option>
            <option value="subject">Subject</option>
          </Select>

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/15"
          >
            <Filter className="size-4" aria-hidden="true" />
            Apply
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {viewConfig.map(({ value, label, icon: Icon }) => {
              const active = filters.view === value;
              return (
                <Link
                  key={value}
                  href={buildAssignmentQuery(filters, { view: value, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 bg-white/[0.045] text-slate-400 hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {result.totalResults.toLocaleString()} result
              {result.totalResults === 1 ? "" : "s"}
            </span>
            {filtered ? (
              <Link
                href={buildAssignmentQuery(filters, {
                  q: "",
                  tab: "all",
                  status: "",
                  priority: "",
                  subjectId: 0,
                  page: 1,
                })}
                className="text-sm font-semibold text-cyan-300 hover:underline"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>
      </motion.section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Insight
          label="Completed this week"
          value={result.analytics.completedWeek.toLocaleString()}
          icon={CheckCircle2}
        />
        <Insight
          label="Completed this month"
          value={result.analytics.completedMonth.toLocaleString()}
          icon={BarChart3}
        />
        <Insight
          label="On-time completion"
          value={`${result.analytics.onTimePercent}%`}
          icon={Clock3}
        />
        <Insight
          label="Highest workload"
          value={
            result.analytics.topSubjectCount
              ? `${result.analytics.topSubject} · ${result.analytics.topSubjectCount}`
              : "No active workload"
          }
          icon={Sparkles}
        />
      </section>

      {filters.view === "list" && selectedIds.length > 0 ? (
        <div className="sticky top-20 z-30 flex flex-wrap items-center gap-2 rounded-[20px] border border-cyan-300/20 bg-white/[0.045] p-3 shadow-lg">
          <strong className="mr-auto text-sm text-cyan-300">{selectedIds.length} selected</strong>
          <BulkButton label="Mark in progress" disabled={bulkBusy} onClick={() => runBulk("status", "in_progress")} />
          <BulkButton label="Mark done" disabled={bulkBusy} onClick={() => runBulk("status", "done")} />
          <BulkButton label="Archive" disabled={bulkBusy} onClick={() => runBulk("archive")} />
          <BulkButton label="Recycle" disabled={bulkBusy} danger onClick={() => runBulk("trash")} />
          <button type="button" onClick={() => setSelectedIds([])} className="min-h-9 rounded-full px-3 text-sm font-semibold text-slate-400 hover:bg-white/[0.06]">Clear</button>
          {bulkBusy ? <Loader2 className="size-4 animate-spin text-cyan-300" /> : null}
        </div>
      ) : null}

      {result.assignments.length > 0 ? (
        filters.view === "board" ? (
          <AssignmentBoard assignments={result.assignments} />
        ) : filters.view === "calendar" ? (
          <AssignmentCalendar assignments={result.assignments} filters={filters} />
        ) : (
          <section className="space-y-3">
            {result.assignments.map((assignment, index) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                index={index}
                manageable
                subjects={result.subjects}
                selected={selectedIds.includes(assignment.id)}
                onSelectedChange={(id, selected) => setSelectedIds((items) => selected ? Array.from(new Set([...items, id])) : items.filter((item) => item !== id))}
              />
            ))}
          </section>
        )
      ) : (
        <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-cyan-300/20 bg-white/[0.045] p-8 text-center">
          <div className="max-w-md">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <SearchX className="size-7" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-100">
              No matching assignments
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Clear a filter, change the selected tab, or try another search term.
            </p>
          </div>
        </div>
      )}

      {filters.view === "list" && result.totalPages > 1 ? (
        <Pagination result={result} />
      ) : null}

      <p className="text-center text-xs text-slate-500">
        Data access: {result.accessMode === "service-role" ? "secure server client" : "authenticated policies"}
      </p>
      <AssignmentEditorDialog open={creating} assignment={null} subjects={result.subjects} onClose={() => setCreating(false)} />
      <SubjectManagerDialog open={managingSubjects} initialSubjects={result.subjects} onClose={() => setManagingSubjects(false)} />
    </main>
  );
}

function BulkButton({ label, onClick, disabled, danger = false }: { label: string; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`min-h-9 rounded-full border px-3 text-sm font-semibold transition disabled:opacity-50 ${danger ? "border-red-300/25 text-red-300 hover:bg-red-400/10" : "border-white/10 text-slate-200 hover:bg-white/[0.06]"}`}>{label}</button>;
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
  tone: "blue" | "amber" | "red" | "green";
}) {
  const tones = {
    blue: "bg-cyan-400/10 text-cyan-300",
    amber: "bg-amber-400/10 text-amber-300",
    red: "bg-red-400/10 text-red-300",
    green: "bg-emerald-400/10 text-emerald-300",
  };
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.035] p-3.5">
      <span className={`grid size-8 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <strong className="mt-3 block text-xl font-semibold text-slate-100">
        {value.toLocaleString()}
      </strong>
      <span className="mt-0.5 block text-xs font-medium text-slate-400">{label}</span>
    </div>
  );
}

function Insight({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock3;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.045] p-4 shadow-sm"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-slate-400">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <small className="block text-xs font-medium text-slate-400">{label}</small>
        <strong className="mt-1 block truncate text-sm font-semibold text-slate-100">
          {value}
        </strong>
      </span>
    </motion.div>
  );
}

function Select({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        aria-label={label}
        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm text-slate-200 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15"
      >
        {children}
      </select>
    </label>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-300">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function Pagination({ result }: { result: AssignmentBrowserResult }) {
  const previous = Math.max(1, result.page - 1);
  const next = Math.min(result.totalPages, result.page + 1);
  return (
    <nav
      aria-label="Assignment pagination"
      className="flex flex-col items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.045] p-3 shadow-sm sm:flex-row"
    >
      <span className="px-2 text-sm text-slate-400">
        Page {result.page.toLocaleString()} of {result.totalPages.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={buildAssignmentQuery(result.filters, { page: previous })}
          aria-disabled={result.page <= 1}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            result.page <= 1
              ? "pointer-events-none border-white/10 text-slate-500"
              : "border-white/10 text-slate-200 hover:bg-white/[0.06]"
          }`}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Link>
        <Link
          href={buildAssignmentQuery(result.filters, { page: next })}
          aria-disabled={result.page >= result.totalPages}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            result.page >= result.totalPages
              ? "pointer-events-none border-white/10 text-slate-500"
              : "border-white/10 text-slate-200 hover:bg-white/[0.06]"
          }`}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
