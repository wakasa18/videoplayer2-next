/* eslint-disable react-hooks/set-state-in-effect -- form fields reset when a different assignment is opened */
"use client";

import { ModalPortal } from "@/components/ui/modal-portal";

import { AnimatePresence, motion } from "motion/react";
import { Check, ClipboardPlus, FileText, Loader2, Paperclip, Search, X } from "lucide-react";
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
  const [attachmentQuery, setAttachmentQuery] = useState("");
  const [attachmentResults, setAttachmentResults] = useState<Array<{ id: number; title: string; original_filename: string }>>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [searchingFiles, setSearchingFiles] = useState(false);
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
    setSelectedFileIds([]);
    setAttachmentResults([]);
    setAttachmentQuery("");
    setError("");
  }, [assignment, open]);

  async function searchFiles() {
    setSearchingFiles(true);
    try {
      const response = await fetch(`/api/assignments/files?q=${encodeURIComponent(attachmentQuery)}`, { cache: "no-store" });
      const payload = await response.json() as { files?: Array<{ id: number; title: string; original_filename: string }>; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not search Important Files.");
      setAttachmentResults(payload.files ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not search Important Files."); }
    finally { setSearchingFiles(false); }
  }

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
            customReminderAt: customReminderAt ? manilaInputToIso(customReminderAt) : "",
            recurrence,
            recurrenceUntil,
          }),
        },
      );
      const payload = await response.json() as { id?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The assignment could not be saved.");
      const assignmentId = assignment?.id ?? Number(payload.id);
      if (assignmentId && selectedFileIds.length) {
        const results = await Promise.all(selectedFileIds.map((fileId) => fetch(`/api/assignments/${assignmentId}/files`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId }) })));
        if (results.some((item) => !item.ok)) throw new Error("The assignment was saved, but one or more file attachments could not be linked.");
      }
      onClose();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assignment could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalPortal>
      <AnimatePresence>
      {open ? (
        <motion.div
          className="tech-modal-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-3 sm:p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !submitting) onClose();
          }}
        >
          <motion.form
            onSubmit={submit}
            className="tech-modal-surface max-h-[94dvh] w-full max-w-3xl overflow-auto rounded-[28px] border"
            initial={{ opacity: 0, y: 18, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: .98 }}
            transition={{ type: "spring", stiffness: 330, damping: 28 }}
          >
            <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/10 bg-[#0b1220]/95 p-5 backdrop-blur sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><ClipboardPlus className="size-5" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-100">{assignment ? "Edit assignment" : "New assignment"}</h2><p className="mt-1 text-sm text-slate-400">Manage the task, deadline, recurrence, subject, and reminder.</p></div>
              <button type="button" onClick={onClose} disabled={submitting} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"><X className="size-5" /><span className="sr-only">Close</span></button>
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
              <Field label="Custom reminder (Philippine time)"><input type="datetime-local" value={customReminderAt} onChange={(e) => setCustomReminderAt(e.target.value)} className={inputClass} /><span className="mt-2 block text-[11px] leading-5 text-slate-500">This Philippine-time schedule overrides the relative reminder above and uses every notification channel you enabled.</span></Field>
              <Field label="Repeat schedule"><select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputClass}><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option></select></Field>
              <Field label="Repeat until"><input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} disabled={!recurrence} className={`${inputClass} disabled:bg-white/[0.05] disabled:text-slate-500`} /></Field>
              <Field label="Reference link" className="md:col-span-2"><input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." maxLength={500} className={inputClass} /></Field>
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[.025] p-4">
                <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Paperclip className="size-4" /></span><div><strong className="text-sm text-slate-200">Attach from Important Files</strong><p className="mt-1 text-xs leading-5 text-slate-500">Select existing workspace files now. They will be linked when the assignment is saved.</p></div></div>
                <div className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><input value={attachmentQuery} onChange={(e) => setAttachmentQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchFiles(); } }} placeholder="Search files to attach" className={`${inputClass} pl-10`} /></div><button type="button" onClick={() => void searchFiles()} disabled={searchingFiles} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/[.06]">{searchingFiles ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Find</button></div>
                {attachmentResults.length ? <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">{attachmentResults.slice(0, 20).map((file) => { const chosen = selectedFileIds.includes(file.id); return <button key={file.id} type="button" onClick={() => setSelectedFileIds((current) => chosen ? current.filter((id) => id !== file.id) : [...current, file.id])} className={`flex items-center gap-2 rounded-xl border p-2.5 text-left ${chosen ? "border-cyan-300/30 bg-cyan-300/[.08]" : "border-white/[.08] bg-white/[.025] hover:bg-white/[.05]"}`}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[.04] text-cyan-300">{chosen ? <Check className="size-4" /> : <FileText className="size-4" />}</span><span className="min-w-0"><strong className="block truncate text-xs text-slate-200">{file.title}</strong><small className="block truncate text-[10px] text-slate-500">{file.original_filename}</small></span></button>; })}</div> : null}
                {selectedFileIds.length ? <p className="mt-2 text-[11px] font-semibold text-cyan-300">{selectedFileIds.length} file{selectedFileIds.length === 1 ? "" : "s"} selected for attachment</p> : null}
              </div>
              {error ? <div role="alert" className="md:col-span-2 rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
            </div>

            <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-white/10 bg-[#0b1220]/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-full border border-white/10 px-5 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]">Cancel</button>
              <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">{submitting ? <Loader2 className="size-4 animate-spin" /> : null}{assignment ? "Save changes" : "Create assignment"}</button>
            </footer>
          </motion.form>
        </motion.div>
      ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>;
}

function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // The assignment UI uses Philippine time regardless of the device timezone.
  return new Date(date.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 16);
}

function manilaInputToIso(value: string): string {
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}+08:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

const inputClass = "min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15";
