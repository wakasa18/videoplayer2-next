import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GraduationCap,
  Link2,
  ListChecks,
  Paperclip,
  Repeat2,
  StickyNote,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentDetailActions } from "@/components/assignments/assignment-detail-actions";
import { AttachmentManager } from "@/components/assignments/attachment-manager";
import { NoteManager } from "@/components/assignments/note-manager";
import { SubtaskManager } from "@/components/assignments/subtask-manager";
import { getAssignmentDetails, getAssignmentSubjects } from "@/lib/assignments/data";
import {
  formatAssignmentDue,
  formatDateTime,
  isAssignmentOverdue,
  priorityLabel,
  recurrenceLabel,
  statusLabel,
} from "@/lib/assignments/utils";

type AssignmentDetailsPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: AssignmentDetailsPageProps) {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return { title: "Assignment" };
  const details = await getAssignmentDetails(id).catch(() => null);
  return { title: details?.assignment.title ?? "Assignment" };
}

export default async function AssignmentDetailsPage({ params }: AssignmentDetailsPageProps) {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(id) || id < 1) notFound();

  const [details, subjects] = await Promise.all([
    getAssignmentDetails(id),
    getAssignmentSubjects(),
  ]);
  if (!details) notFound();

  const { assignment, subject, subtasks, notes, attachments } = details;
  const overdue = isAssignmentOverdue(assignment);
  const progress = assignment.subtask_total
    ? Math.round((assignment.subtask_done / assignment.subtask_total) * 100)
    : 0;
  const externalUrl = safeExternalUrl(assignment.link_url);

  return (
    <main className="space-y-5">
      <Link
        href="/dashboard/assignments"
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#1967d2] transition hover:bg-[#e8f0fe]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to assignments
      </Link>

      <section
        className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8"
        style={{ borderTopWidth: 5, borderTopColor: assignment.subject_color }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: `${assignment.subject_color}16`,
                  color: assignment.subject_color,
                }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: assignment.subject_color }}
                />
                {assignment.subject_code || assignment.subject_name}
              </span>
              <Badge tone={statusTone(assignment.status)}>{statusLabel(assignment.status)}</Badge>
              <Badge tone={priorityTone(assignment.priority)}>
                {priorityLabel(assignment.priority)} priority
              </Badge>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-.04em] text-[#202124] sm:text-4xl">
              {assignment.title}
            </h1>
            {assignment.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#5f6368] sm:text-base">
                {assignment.description}
              </p>
            ) : (
              <p className="mt-4 text-sm italic text-[#80868b]">No description provided.</p>
            )}
            <div className="mt-5">
              <AssignmentDetailActions assignment={assignment} subjects={subjects} />
            </div>
          </div>
          <div
            className={`min-w-[230px] rounded-[22px] border p-4 ${
              overdue
                ? "border-[#f6c7c3] bg-[#fff7f6]"
                : "border-[#d2e3fc] bg-[#f8fbff]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid size-11 place-items-center rounded-2xl ${
                  overdue ? "bg-[#fce8e6] text-[#c5221f]" : "bg-[#e8f0fe] text-[#1967d2]"
                }`}
              >
                {assignment.due_time ? (
                  <Clock3 className="size-5" aria-hidden="true" />
                ) : (
                  <CalendarDays className="size-5" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#80868b]">
                  {overdue ? "Overdue" : "Deadline"}
                </p>
                <strong className={`mt-1 block text-sm ${overdue ? "text-[#c5221f]" : "text-[#202124]"}`}>
                  {formatAssignmentDue(assignment.due_date, assignment.due_time)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {assignment.subtask_total > 0 ? (
          <div className="mt-7 border-t border-[#eef1f3] pt-5">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#5f6368]">
              <span>{assignment.subtask_done} of {assignment.subtask_total} subtasks completed</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e8eaed]">
              <span className="block h-full rounded-full bg-[#1a73e8]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(310px,.65fr)]">
        <div className="space-y-5">
          <Panel icon={ListChecks} title="Subtasks" count={subtasks.length}>
            <SubtaskManager assignmentId={assignment.id} initialSubtasks={subtasks} />
          </Panel>

          <Panel icon={StickyNote} title="Notes" count={notes.length}>
            <NoteManager assignmentId={assignment.id} initialNotes={notes} />
          </Panel>

          <Panel icon={Paperclip} title="Linked files" count={attachments.length}>
            <AttachmentManager assignmentId={assignment.id} initialAttachments={attachments} />
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel icon={GraduationCap} title="Assignment information">
            <dl className="space-y-3">
              <InfoRow label="Subject" value={assignment.subject_name} />
              {subject?.code ? <InfoRow label="Code" value={subject.code} /> : null}
              {subject?.instructor ? <InfoRow label="Instructor" value={subject.instructor} icon={UserRound} /> : null}
              {subject?.schedule ? <InfoRow label="Schedule" value={subject.schedule} /> : null}
              {subject?.semester ? <InfoRow label="Semester" value={subject.semester} /> : null}
              <InfoRow label="Created" value={formatDateTime(assignment.created_at)} />
              <InfoRow label="Updated" value={formatDateTime(assignment.updated_at)} />
              {assignment.completed_at ? (
                <InfoRow label="Completed" value={formatDateTime(assignment.completed_at)} icon={CheckCircle2} />
              ) : null}
            </dl>
          </Panel>

          <Panel icon={Repeat2} title="Schedule and resources">
            <dl className="space-y-3">
              <InfoRow label="Recurrence" value={recurrenceLabel(assignment.recurrence)} />
              {assignment.recurrence_until ? <InfoRow label="Repeats until" value={formatAssignmentDue(assignment.recurrence_until, null)} /> : null}
              {assignment.occurrence_index > 0 ? <InfoRow label="Occurrence" value={`#${assignment.occurrence_index + 1}`} /> : null}
              <InfoRow
                label="Reminder"
                value={formatReminder(assignment.reminder_minutes_before, assignment.custom_reminder_at)}
              />
              {assignment.snoozed_until ? <InfoRow label="Snoozed until" value={formatDateTime(assignment.snoozed_until)} /> : null}
              {assignment.reminder_sent_at ? <InfoRow label="Last reminder" value={formatDateTime(assignment.reminder_sent_at)} /> : null}
            </dl>
            {externalUrl ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#d2e3fc] bg-[#e8f0fe] p-3.5 text-sm font-semibold text-[#1967d2] transition hover:bg-[#dbe8fd]"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Link2 className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Open assignment link</span>
                </span>
                <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
              </a>
            ) : null}
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function Panel({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof ListChecks;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#f1f3f4] text-[#5f6368]">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-[#202124]">{title}</h2>
        </div>
        {typeof count === "number" ? (
          <span className="rounded-full bg-[#f1f3f4] px-3 py-1 text-xs font-semibold text-[#5f6368]">{count}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof UserRound;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e5ea] bg-[#f8f9fa] px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-[#80868b]">
        {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-sm font-semibold text-[#3c4043]">{value}</dd>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "blue" | "green" | "red" | "amber" | "gray";
  children: React.ReactNode;
}) {
  const classes = {
    blue: "bg-[#e8f0fe] text-[#1967d2]",
    green: "bg-[#e6f4ea] text-[#137333]",
    red: "bg-[#fce8e6] text-[#c5221f]",
    amber: "bg-[#fef7e0] text-[#9a5b00]",
    gray: "bg-[#f1f3f4] text-[#5f6368]",
  };
  return <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}


function statusTone(status: string): "blue" | "green" | "red" | "amber" | "gray" {
  if (status === "done") return "green";
  if (status === "blocked") return "red";
  if (status === "submitted") return "amber";
  if (status === "in_progress") return "blue";
  return "gray";
}
function priorityTone(priority: string): "green" | "red" | "amber" {
  if (priority === "high") return "red";
  if (priority === "low") return "green";
  return "amber";
}
function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
function formatReminder(minutes: number, custom: string | null): string {
  if (custom) return formatDateTime(custom);
  if (minutes <= 0) return "At the deadline";
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"} before`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"} before`;
  return `${minutes} minutes before`;
}
