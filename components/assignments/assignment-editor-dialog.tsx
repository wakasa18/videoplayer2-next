/* eslint-disable react-hooks/set-state-in-effect -- form fields reset when a different assignment is opened */
"use client";

import { AnimatePresence, motion } from "motion/react";
import { ClipboardPlus, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import type {
  AssignmentItem,
  AssignmentSubject,
} from "@/lib/assignments/types";

export function AssignmentEditorDialog({
  open,
  assignment,
  subjects,
  onClose,
}: {
  open: boolean;
  assignment: AssignmentItem | null;
  subjects: AssignmentSubject[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [status, setStatus] = useState("to_do");
  const [priority, setPriority] = useState("medium");
  const [subjectId, setSubjectId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("1440");
  const [customReminderAt, setCustomReminderAt] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(assignment?.title ?? "");
    setDescription(assignment?.description ?? "");
    setDueDate(assignment?.due_date ?? "");
    setDueTime(assignment?.due_time ?? "");
    setStatus(assignment?.status ?? "to_do");
    setPriority(assignment?.priority ?? "medium");
    setSubjectId(assignment?.subject_id ? String(assignment.subject_id) : "");
    setLinkUrl(assignment?.link_url ?? "");
    setReminderMinutes(String(assignment?.reminder_minutes_before ?? 1440));
    setCustomReminderAt(toLocalDateTime(assignment?.custom_reminder_at ?? null));
    setRecurrence(assignment?.recurrence ?? "");
    setRecurrenceUntil(assignment?.recurrence_until ?? "");
    setError("");
  }, [assignment, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        assignment ? `/api/assignments/${assignment.id}` : "/api/assignments",
        {
          method: assignment ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(assignment ? { action: "metadata" } : {}),
            title,
            description,
            dueDate,
            dueTime,
            status,
            priority,
            subjectId,
            linkUrl,
            reminderMinutesBefore: reminderMinutes,
            customReminderAt: customReminderAt ? new Date(customReminderAt).toISOString() : "",
            recurrence,
            recurrenceUntil,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The assignment could not be saved.");
      onClose();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assignment could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#202124]/45 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !submitting) onClose();
          }}
        >
          <motion.form
            onSubmit={submit}
            className="max-h-[94vh] w-full max-w-3xl overflow-auto rounded-[28px] border border-[#e1e5ea] bg-white shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: .98 }}
            transition={{ type: "spring", stiffness: 330, damping: 28 }}
          >
            <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-[#eef1f3] bg-white/95 p-5 backdrop-blur sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><ClipboardPlus className="size-5" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-[#202124]">{assignment ? "Edit assignment" : "New assignment"}</h2><p className="mt-1 text-sm text-[#80868b]">Manage the task, deadline, recurrence, subject, and reminder.</p></div>
              <button type="button" onClick={onClose} disabled={submitting} className="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"><X className="size-5" /><span className="sr-only">Close</span></button>
            </header>

            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
              <Field label="Title" className="md:col-span-2"><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} className={inputClass} /></Field>
              <Field label="Description" className="md:col-span-2"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={10000} className={`${inputClass} min-h-28 resize-y py-3`} /></Field>
              <Field label="Deadline date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} /></Field>
              <Field label="Deadline time"><input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={inputClass} /></Field>
              <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="to_do">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="submitted">Submitted</option><option value="done">Done</option></select></Field>
              <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
              <Field label="Subject"><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}><option value="">General</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code ? `${subject.code} · ` : ""}{subject.name}</option>)}</select></Field>
              <Field label="Reminder"><select value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)} className={inputClass}><option value="0">At deadline</option><option value="60">1 hour before</option><option value="180">3 hours before</option><option value="1440">1 day before</option><option value="2880">2 days before</option><option value="10080">1 week before</option></select></Field>
              <Field label="Custom reminder"><input type="datetime-local" value={customReminderAt} onChange={(e) => setCustomReminderAt(e.target.value)} className={inputClass} /></Field>
              <Field label="Repeat schedule"><select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputClass}><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option></select></Field>
              <Field label="Repeat until"><input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} disabled={!recurrence} className={`${inputClass} disabled:bg-[#f1f3f4] disabled:text-[#9aa0a6]`} /></Field>
              <Field label="Reference link" className="md:col-span-2"><input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." maxLength={500} className={inputClass} /></Field>
              {error ? <div role="alert" className="md:col-span-2 rounded-2xl border border-[#f6c7c3] bg-[#fce8e6] px-4 py-3 text-sm text-[#a50e0e]">{error}</div> : null}
            </div>

            <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#eef1f3] bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-full border border-[#dadce0] px-5 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]">Cancel</button>
              <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white hover:bg-[#1557b0] disabled:opacity-60">{submitting ? <Loader2 className="size-4 animate-spin" /> : null}{assignment ? "Save changes" : "Create assignment"}</button>
            </footer>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-xs font-semibold text-[#5f6368]">{label}</span>{children}</label>;
}

function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

const inputClass = "min-h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-4 text-sm text-[#202124] outline-none transition focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]";
