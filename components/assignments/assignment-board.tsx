"use client";

import { CheckCircle2, Circle, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { motion } from "motion/react";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import type { AssignmentItem, AssignmentStatus } from "@/lib/assignments/types";
import { statusLabel } from "@/lib/assignments/utils";

const columns: Array<{
  status: AssignmentStatus;
  icon: typeof Circle;
  accent: string;
}> = [
  { status: "to_do", icon: Circle, accent: "#80868b" },
  { status: "in_progress", icon: LoaderCircle, accent: "#1a73e8" },
  { status: "blocked", icon: CircleAlert, accent: "#d93025" },
  { status: "submitted", icon: Send, accent: "#f9ab00" },
  { status: "done", icon: CheckCircle2, accent: "#188038" },
];

export function AssignmentBoard({ assignments }: { assignments: AssignmentItem[] }) {
  return (
    <div className="overflow-x-auto pb-3 [scrollbar-color:#c7cdd1_transparent]">
      <div className="grid min-w-[1320px] grid-cols-5 gap-4">
        {columns.map(({ status, icon: Icon, accent }, columnIndex) => {
          const items = assignments.filter((assignment) => assignment.status === status);
          return (
            <motion.section
              key={status}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: columnIndex * 0.05, duration: 0.25 }}
              className="min-h-[440px] rounded-[24px] border border-white/10 bg-white/[0.035] p-3"
            >
              <header className="mb-3 flex items-center justify-between gap-3 px-2 py-1">
                <div className="flex items-center gap-2">
                  <span
                    className="grid size-8 place-items-center rounded-xl bg-white/[0.045] shadow-sm"
                    style={{ color: accent }}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold text-slate-100">
                    {statusLabel(status)}
                  </h2>
                </div>
                <span className="rounded-full bg-white/[0.045] px-2.5 py-1 text-xs font-semibold text-slate-400 shadow-sm">
                  {items.length}
                </span>
              </header>
              <div className="space-y-3">
                {items.length > 0 ? (
                  items.map((assignment, index) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      index={columnIndex * 4 + index}
                      compact
                    />
                  ))
                ) : (
                  <div className="grid min-h-28 place-items-center rounded-[18px] border border-dashed border-white/10 bg-white/70 p-4 text-center text-xs leading-5 text-slate-400">
                    No assignments in this stage
                  </div>
                )}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
