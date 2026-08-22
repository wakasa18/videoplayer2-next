"use client";

import { Archive, ArrowLeft, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import type { AssignmentCollectionResult } from "@/lib/assignments/types";

export function AssignmentCollection({
  mode,
  result,
}: {
  mode: "archive" | "recycle";
  result: AssignmentCollectionResult;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const isRecycle = mode === "recycle";

  async function itemAction(id: number, action: "restore" | "unarchive" | "delete") {
    if (action === "delete" && !window.confirm("Permanently delete this assignment and its subtasks, notes, and links?")) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: action === "delete" ? undefined : JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The assignment could not be updated.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The assignment could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  async function bulk(action: "restore" | "delete") {
    if (!selected.length || bulkBusy) return;
    if (action === "delete" && !window.confirm(`Permanently delete ${selected.length} assignments?`)) return;
    setBulkBusy(true);
    try {
      const response = await fetch("/api/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selected }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The assignments could not be updated.");
      setSelected([]);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The assignments could not be updated.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="space-y-5">
      <Link href="/dashboard/assignments" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#1967d2] hover:bg-[#e8f0fe]"><ArrowLeft className="size-4" />Back to assignments</Link>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4"><span className={`grid size-14 place-items-center rounded-2xl ${isRecycle ? "bg-[#fce8e6] text-[#c5221f]" : "bg-[#e8f0fe] text-[#1967d2]"}`}>{isRecycle ? <Trash2 className="size-7" /> : <Archive className="size-7" />}</span><div><p className="text-xs font-bold uppercase tracking-[.08em] text-[#80868b]">Phase 5B</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#202124]">{isRecycle ? "Assignment Recycle Bin" : "Archived assignments"}</h1><p className="mt-2 text-sm leading-6 text-[#5f6368]">{isRecycle ? "Restore assignments or permanently remove them after review." : "Keep completed or inactive work out of the main assignment list."}</p></div></div>
      </motion.section>

      {selected.length && isRecycle ? <div className="sticky top-20 z-30 flex flex-wrap items-center gap-2 rounded-[20px] border border-[#d2e3fc] bg-white p-3 shadow-lg"><strong className="mr-auto text-sm text-[#1967d2]">{selected.length} selected</strong><button onClick={() => bulk("restore")} disabled={bulkBusy} className="min-h-9 rounded-full border border-[#dadce0] px-4 text-sm font-semibold">Restore</button><button onClick={() => bulk("delete")} disabled={bulkBusy} className="min-h-9 rounded-full border border-[#f6c7c3] px-4 text-sm font-semibold text-[#c5221f]">Delete permanently</button>{bulkBusy ? <Loader2 className="size-4 animate-spin" /> : null}</div> : null}

      {result.assignments.length ? (
        <section className="space-y-3">
          {result.assignments.map((assignment, index) => (
            <div key={assignment.id} className="rounded-[22px]">
              <div className="relative [&_a]:pointer-events-none">
                {isRecycle ? (
                  <label className="absolute left-4 top-4 z-20 grid size-9 cursor-pointer place-items-center rounded-full bg-white/95 shadow-sm hover:bg-[#f1f3f4]">
                    <input
                      type="checkbox"
                      checked={selected.includes(assignment.id)}
                      onChange={(event) =>
                        setSelected((items) =>
                          event.target.checked
                            ? Array.from(new Set([...items, assignment.id]))
                            : items.filter((item) => item !== assignment.id),
                        )
                      }
                      className="size-4 accent-[#1a73e8]"
                      aria-label={`Select ${assignment.title}`}
                    />
                  </label>
                ) : null}
                <AssignmentCard
                  assignment={assignment}
                  index={index}
                  subjects={result.subjects}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                {isRecycle ? (
                  <>
                    <button onClick={() => itemAction(assignment.id, "restore")} disabled={busyId === assignment.id} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold hover:bg-[#f8f9fa]"><RotateCcw className="size-4" />Restore</button>
                    <button onClick={() => itemAction(assignment.id, "delete")} disabled={busyId === assignment.id} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#f6c7c3] bg-white px-4 text-sm font-semibold text-[#c5221f] hover:bg-[#fce8e6]"><Trash2 className="size-4" />Delete permanently</button>
                  </>
                ) : (
                  <button onClick={() => itemAction(assignment.id, "unarchive")} disabled={busyId === assignment.id} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-semibold hover:bg-[#f8f9fa]"><RotateCcw className="size-4" />Return to active</button>
                )}
                {busyId === assignment.id ? <Loader2 className="size-4 animate-spin text-[#1967d2]" /> : null}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-[#c6dafc] bg-white p-8 text-center">
          <div>
            <h2 className="text-lg font-semibold text-[#202124]">Nothing here</h2>
            <p className="mt-2 text-sm text-[#5f6368]">{isRecycle ? "Deleted assignments will appear here." : "Archived assignments will appear here."}</p>
          </div>
        </div>
      )}
    </main>
  );
}
