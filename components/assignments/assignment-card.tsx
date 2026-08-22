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
  to_do: "bg-[#f1f3f4] text-[#5f6368]",
  in_progress: "bg-[#e8f0fe] text-[#1967d2]",
  blocked: "bg-[#fce8e6] text-[#c5221f]",
  submitted: "bg-[#fef7e0] text-[#9a5b00]",
  done: "bg-[#e6f4ea] text-[#137333]",
};

const priorityClasses = {
  low: "bg-[#e6f4ea] text-[#137333]",
  medium: "bg-[#fef7e0] text-[#9a5b00]",
  high: "bg-[#fce8e6] text-[#c5221f]",
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
      className={`group relative overflow-visible rounded-[22px] border bg-white shadow-sm transition-colors hover:border-[#c6dafc] hover:shadow-md ${
        overdue ? "border-[#f6c7c3]" : "border-[#e1e5ea]"
      } ${selected ? "ring-4 ring-[#d2e3fc]" : ""}`}
      style={{ borderLeftWidth: 4, borderLeftColor: assignment.subject_color }}
    >
      {manageable ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
          <label className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-[#f1f3f4]">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectedChange?.(assignment.id, event.target.checked)}
              className="size-4 rounded border-[#bdc1c6] accent-[#1a73e8]"
              aria-label={`Select ${assignment.title}`}
            />
          </label>
          <AssignmentItemActions assignment={assignment} subjects={subjects} />
        </div>
      ) : null}

      <Link
        href={`/dashboard/assignments/${assignment.id}`}
        className={`block rounded-[22px] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d2e3fc] ${
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
            <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-[#202124] group-hover:text-[#174ea6]">{assignment.title}</h3>
            {!compact && assignment.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5f6368]">{assignment.description}</p> : null}
          </div>
          {!manageable ? <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#f8f9fa] text-[#5f6368] transition group-hover:bg-[#e8f0fe] group-hover:text-[#1967d2]"><FileText className="size-5" /></span> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[#5f6368]">
          <span className={`inline-flex items-center gap-1.5 ${overdue ? "text-[#c5221f]" : ""}`}>
            {assignment.due_time ? <Clock3 className="size-3.5" /> : <CalendarDays className="size-3.5" />}
            {overdue ? "Overdue · " : ""}{formatAssignmentDue(assignment.due_date, assignment.due_time)}
          </span>
          {assignment.recurrence ? <span className="inline-flex items-center gap-1.5"><Repeat2 className="size-3.5" />{recurrenceLabel(assignment.recurrence)}</span> : null}
          {assignment.note_count > 0 ? <span className="inline-flex items-center gap-1.5"><StickyNote className="size-3.5" />{assignment.note_count}</span> : null}
          {assignment.attachment_count > 0 ? <span className="inline-flex items-center gap-1.5"><Paperclip className="size-3.5" />{assignment.attachment_count}</span> : null}
        </div>

        {assignment.subtask_total > 0 ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#80868b]"><span className="inline-flex items-center gap-1.5"><ListChecks className="size-3.5" />{assignment.subtask_done}/{assignment.subtask_total} subtasks</span><span>{progress}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e8eaed]"><motion.span initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ delay: 0.14 + Math.min(index, 10) * 0.02, duration: 0.45 }} className="block h-full rounded-full bg-[#1a73e8]" /></div>
          </div>
        ) : null}
      </Link>
    </motion.article>
  );
}
