"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import type { AssignmentFilters, AssignmentItem } from "@/lib/assignments/types";
import {
  adjacentMonth,
  buildAssignmentQuery,
  currentDateKey,
  formatAssignmentDue,
} from "@/lib/assignments/utils";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AssignmentCalendar({
  assignments,
  filters,
}: {
  assignments: AssignmentItem[];
  filters: AssignmentFilters;
}) {
  const [year, month] = filters.month.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - mondayOffset);
  const today = currentDateKey();
  const byDate = new Map<string, AssignmentItem[]>();
  assignments.forEach((assignment) => {
    if (!assignment.due_date) return;
    const list = byDate.get(assignment.due_date) ?? [];
    list.push(assignment);
    byDate.set(assignment.due_date, list);
  });
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date, key, currentMonth: date.getMonth() === month - 1 };
  });
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(firstDay);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e1e5ea] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-[#eef1f3] px-4 py-4 sm:px-6">
        <Link
          href={buildAssignmentQuery(filters, {
            month: adjacentMonth(filters.month, -1),
            page: 1,
          })}
          aria-label="Previous month"
          className="grid size-10 place-items-center rounded-full border border-[#e1e5ea] text-[#5f6368] transition hover:bg-[#f1f3f4]"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#80868b]">
            Calendar
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#202124]">{monthLabel}</h2>
        </div>
        <Link
          href={buildAssignmentQuery(filters, {
            month: adjacentMonth(filters.month, 1),
            page: 1,
          })}
          aria-label="Next month"
          className="grid size-10 place-items-center rounded-full border border-[#e1e5ea] text-[#5f6368] transition hover:bg-[#f1f3f4]"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-7 border-b border-[#e1e5ea] bg-[#f8f9fa]">
            {weekdays.map((weekday) => (
              <div
                key={weekday}
                className="px-3 py-2.5 text-center text-xs font-semibold text-[#5f6368]"
              >
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-[#e1e5ea] gap-px">
            {cells.map(({ date, key, currentMonth }, index) => {
              const dayAssignments = byDate.get(key) ?? [];
              const isToday = key === today;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index, 20) * 0.012 }}
                  className={`min-h-32 bg-white p-2.5 ${
                    currentMonth ? "" : "bg-[#f8f9fa]"
                  }`}
                >
                  <div
                    className={`mb-2 grid size-7 place-items-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-[#1a73e8] text-white"
                        : currentMonth
                          ? "text-[#3c4043]"
                          : "text-[#9aa0a6]"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1.5">
                    {dayAssignments.slice(0, 3).map((assignment) => (
                      <Link
                        key={assignment.id}
                        href={`/dashboard/assignments/${assignment.id}`}
                        title={`${assignment.title} — ${formatAssignmentDue(assignment.due_date, assignment.due_time)}`}
                        className="block truncate rounded-lg border px-2 py-1.5 text-[11px] font-semibold text-[#3c4043] transition hover:brightness-95"
                        style={{
                          borderColor: `${assignment.subject_color}55`,
                          backgroundColor: `${assignment.subject_color}14`,
                          borderLeftWidth: 3,
                          borderLeftColor: assignment.subject_color,
                        }}
                      >
                        {assignment.due_time ? `${assignment.due_time} ` : ""}
                        {assignment.title}
                      </Link>
                    ))}
                    {dayAssignments.length > 3 ? (
                      <span className="block px-1 text-[11px] font-semibold text-[#5f6368]">
                        +{dayAssignments.length - 3} more
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
