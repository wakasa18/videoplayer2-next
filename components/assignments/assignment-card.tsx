"use client";

import {
  CalendarDays,
  Clock3,
  FileText,
  ListChecks,
  Paperclip,
  Repeat2,
  StickyNote,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { AssignmentItemActions } from "@/components/assignments/assignment-item-actions";
import type {
  AssignmentItem,
  AssignmentSubject,
} from "@/lib/assignments/types";
import {
  formatAssignmentDue,
  isAssignmentOverdue,
  priorityLabel,
  recurrenceLabel,
  statusLabel,
} from "@/lib/assignments/utils";

type AssignmentCardProps = {
  assignment: AssignmentItem;
  index: number;
  compact?: boolean;
  manageable?: boolean;
  subjects?: AssignmentSubject[];
  selected?: boolean;
  onSelectedChange?: (id: number, selected: boolean) => void;
};

const statusClasses = {
  to_do: "bg-white/[0.05] text-slate-400",
  in_progress: "bg-cyan-400/10 text-cyan-300",
  blocked: "bg-red-400/10 text-red-300",
  submitted: "bg-amber-400/10 text-amber-300",
  done: "bg-emerald-400/10 text-emerald-300",
};

const priorityClasses = {
  low: "bg-emerald-400/10 text-emerald-300",
  medium: "bg-amber-400/10 text-amber-300",
  high: "bg-red-400/10 text-red-300",
};

export function AssignmentCard({
  assignment,
  index,
  compact = false,
  manageable = false,
  subjects = [],
  selected = false,
  onSelectedChange,
}: AssignmentCardProps) {
  const overdue = isAssignmentOverdue(assignment);
  const progress = assignment.subtask_total
    ? Math.round((assignment.subtask_done / assignment.subtask_total) * 100)
    : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 18) * 0.028, duration: 0.24 }}
      whileHover={{ y: -2 }}
      className={`group relative overflow-visible rounded-[22px] border bg-white/[0.045] shadow-sm transition-colors hover:border-cyan-300/35 hover:shadow-md ${
        overdue ? "border-red-300/25" : "border-white/10"
      } ${selected ? "ring-4 ring-cyan-300/15" : ""}`}
      style={{ borderLeftWidth: 4, borderLeftColor: assignment.subject_color }}
    >
      {manageable ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
          <label className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-white/[0.06]">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectedChange?.(assignment.id, event.target.checked)}
              className="size-4 rounded border-white/15 accent-[#1a73e8]"
              aria-label={`Select ${assignment.title}`}
            />
          </label>
          <AssignmentItemActions assignment={assignment} subjects={subjects} />
        </div>
      ) : null}

      <Link
        href={`/dashboard/assignments/${assignment.id}`}
        className={`block rounded-[22px] focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/15 ${
          compact ? "p-4" : "p-5"
        } ${manageable ? "pr-24" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ backgroundColor: `${assignment.subject_color}16`, color: assignment.subject_color }}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: assignment.subject_color }} />
                <span className="truncate">{assignment.subject_code || assignment.subject_name}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[assignment.status]}`}>{statusLabel(assignment.status)}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityClasses[assignment.priority]}`}>{priorityLabel(assignment.priority)}</span>
            </div>
            <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-slate-100 group-hover:text-cyan-300">{assignment.title}</h3>
            {!compact && assignment.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{assignment.description}</p> : null}
          </div>
          {!manageable ? <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/[0.035] text-slate-400 transition group-hover:bg-cyan-400/10 group-hover:text-cyan-300"><FileText className="size-5" /></span> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-400">
          <span className={`inline-flex items-center gap-1.5 ${overdue ? "text-red-300" : ""}`}>
            {assignment.due_time ? <Clock3 className="size-3.5" /> : <CalendarDays className="size-3.5" />}
            {overdue ? "Overdue · " : ""}{formatAssignmentDue(assignment.due_date, assignment.due_time)}
          </span>
          {assignment.recurrence ? <span className="inline-flex items-center gap-1.5"><Repeat2 className="size-3.5" />{recurrenceLabel(assignment.recurrence)}</span> : null}
          {assignment.note_count > 0 ? <span className="inline-flex items-center gap-1.5"><StickyNote className="size-3.5" />{assignment.note_count}</span> : null}
          {assignment.attachment_count > 0 ? <span className="inline-flex items-center gap-1.5"><Paperclip className="size-3.5" />{assignment.attachment_count}</span> : null}
        </div>

        {assignment.subtask_total > 0 ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-400"><span className="inline-flex items-center gap-1.5"><ListChecks className="size-3.5" />{assignment.subtask_done}/{assignment.subtask_total} subtasks</span><span>{progress}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><motion.span initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ delay: 0.14 + Math.min(index, 10) * 0.02, duration: 0.45 }} className="block h-full rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)]" /></div>
          </div>
        ) : null}
      </Link>
    </motion.article>
  );
}
