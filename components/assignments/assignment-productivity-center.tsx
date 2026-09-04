"use client";

import { ModalPortal } from "@/components/ui/modal-portal";

import { motion } from "motion/react";
import {
  AlarmClock,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Loader2,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import type {
  AssignmentProductivityData,
  AssignmentSubject,
  AssignmentTemplate,
} from "@/lib/assignments/types";
import { recurrenceLabel } from "@/lib/assignments/utils";

export function AssignmentProductivityCenter({
  data,
  subjects,
}: {
  data: AssignmentProductivityData;
  subjects: AssignmentSubject[];
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(data.preferences);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AssignmentTemplate | null>(null);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    if (savingPreferences) return;
    setSavingPreferences(true);
    try {
      const response = await fetch("/api/assignments/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preferences",
          inAppEnabled: preferences.in_app_enabled,
          browserEnabled: preferences.browser_enabled,
          emailEnabled: preferences.email_enabled,
          emailAddress: preferences.email_address,
          dailyDigestEnabled: preferences.daily_digest_enabled,
          digestTime: preferences.digest_time,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Preferences could not be saved.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Preferences could not be saved.");
    } finally {
      setSavingPreferences(false);
    }
  }

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") {
      window.alert("Browser notifications are not supported by this browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    setPreferences((current) => ({
      ...current,
      browser_enabled: permission === "granted",
    }));
    if (permission !== "granted") {
      window.alert("Browser notification permission was not granted.");
    }
  }

  async function sendTestEmail() {
    if (testingEmail) return;
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      const response = await fetch("/api/assignments/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress: preferences.email_address }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The test email could not be sent.");
      setEmailTestResult({
        type: "success",
        message: `Test email sent to ${payload.email}.`,
      });
    } catch (error) {
      setEmailTestResult({
        type: "error",
        message: error instanceof Error ? error.message : "The test email could not be sent.",
      });
    } finally {
      setTestingEmail(false);
    }
  }

  async function runAutomation() {
    if (running) return;
    setRunning(true);
    setRunMessage("");
    try {
      const response = await fetch("/api/assignments/automation", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Automation could not run.");
      setRunMessage(
        `${payload.remindersCreated ?? 0} reminders · ${payload.emailsRequested ?? 0} emails sent · ${payload.recurrencesCreated ?? 0} recurring tasks created`,
      );
      router.refresh();
    } catch (error) {
      setRunMessage(error instanceof Error ? error.message : "Automation could not run.");
    } finally {
      setRunning(false);
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
              <Sparkles className="size-4" /> Phase 5C · Automation and productivity
            </div>
            <h1 className="text-3xl font-semibold tracking-[-.04em] text-slate-100 sm:text-4xl">
              Assignment productivity
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Automate reminders and recurring assignments, reuse templates, review progress,
              and keep deadline notifications in one place.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard/assignments" className={secondaryButtonClass}>
                Back to assignments
              </Link>
              <button type="button" onClick={runAutomation} disabled={running} className={primaryButtonClass}>
                {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run reminders now
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateFormOpen(true);
                }}
                className={secondaryButtonClass}
              >
                <Plus className="size-4" /> New template
              </button>
            </div>
            {runMessage ? (
              <p className="mt-3 rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-slate-200">{runMessage}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
            <Stat label="Active" value={data.stats.active} icon={Clock3} />
            <Stat label="Recurring" value={data.stats.recurring} icon={Repeat2} />
            <Stat label="Due in 24h" value={data.stats.dueNext24Hours} icon={CalendarClock} />
            <Stat label="Current streak" value={`${data.stats.currentStreak}d`} icon={Flame} />
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Insight label="Completed in 7 days" value={data.stats.completed7Days} icon={CheckCircle2} />
        <Insight label="Completed in 30 days" value={data.stats.completed30Days} icon={Gauge} />
        <Insight label="30-day completion rate" value={`${data.stats.completionRate30Days}%`} icon={RefreshCw} />
        <Insight label="Overdue now" value={data.stats.overdue} icon={AlarmClock} danger={data.stats.overdue > 0} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.08em] text-slate-400">Reusable workflows</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-100">Assignment templates</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(null);
                setTemplateFormOpen(true);
              }}
              className={secondaryButtonClass}
            >
              <Plus className="size-4" /> Add template
            </button>
          </div>

          {data.templates.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  subject={subjects.find((subject) => subject.id === template.subject_id) ?? null}
                  onEdit={() => {
                    setEditingTemplate(template);
                    setTemplateFormOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No templates yet"
              copy="Create a template for repeated schoolwork, reports, presentations, or capstone milestones."
            />
          )}
        </div>

        <form onSubmit={savePreferences} className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <BellRing className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Reminder settings</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">Times use the Philippine timezone.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <ToggleRow
              label="In-app notifications"
              description="Show reminders in the notification bell."
              checked={preferences.in_app_enabled}
              onChange={(checked) => setPreferences((value) => ({ ...value, in_app_enabled: checked }))}
            />
            <ToggleRow
              label="Browser notifications"
              description="Show operating-system notifications while the app is open."
              checked={preferences.browser_enabled}
              onChange={(checked) => setPreferences((value) => ({ ...value, browser_enabled: checked }))}
              action={
                <button type="button" onClick={enableBrowserNotifications} className="text-xs font-semibold text-cyan-300 hover:underline">
                  Request permission
                </button>
              }
            />
            <ToggleRow
              label="Email reminders"
              description="Send due-soon reminders, overdue alerts, and enabled daily summaries to your email."
              checked={preferences.email_enabled}
              onChange={(checked) => {
                setPreferences((value) => ({ ...value, email_enabled: checked }));
                setEmailTestResult(null);
              }}
            />
            <div className={`rounded-2xl border p-3 ${data.emailService.configured ? "border-emerald-300/20 bg-emerald-400/[0.06]" : "border-amber-300/20 bg-amber-400/[0.06]"}`}>
              <div className="flex items-start gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${data.emailService.configured ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
                  {data.emailService.configured ? <CheckCircle2 className="size-4" /> : <Mail className="size-4" />}
                </span>
                <div className="min-w-0">
                  <strong className="block text-sm text-slate-100">
                    {data.emailService.configured
                      ? `Email service ready via ${data.emailService.provider === "gmail" ? "Gmail SMTP" : "webhook"}`
                      : "Email service needs configuration"}
                  </strong>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {data.emailService.configured
                      ? data.emailService.sender
                        ? `Sender: ${data.emailService.sender}`
                        : "The existing assignment email webhook will be used."
                      : "Add GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD to the Vercel environment variables."}
                  </p>
                </div>
              </div>
            </div>
            {preferences.email_enabled ? (
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">Reminder email</span>
                  <input
                    type="email"
                    value={preferences.email_address ?? ""}
                    onChange={(event) => {
                      setPreferences((value) => ({ ...value, email_address: event.target.value }));
                      setEmailTestResult(null);
                    }}
                    required
                    className={inputClass}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>
                <button
                  type="button"
                  onClick={sendTestEmail}
                  disabled={testingEmail || !preferences.email_address}
                  className={`${secondaryButtonClass} w-full justify-center`}
                >
                  {testingEmail ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send test email
                </button>
                {emailTestResult ? (
                  <p className={`rounded-xl px-3 py-2 text-xs leading-5 ${emailTestResult.type === "success" ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}>
                    {emailTestResult.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            <ToggleRow
              label="Daily digest"
              description="Create one summary for due-today and overdue work."
              checked={preferences.daily_digest_enabled}
              onChange={(checked) => setPreferences((value) => ({ ...value, daily_digest_enabled: checked }))}
            />
            {preferences.daily_digest_enabled ? (
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-400">Digest time</span>
                <input
                  type="time"
                  value={preferences.digest_time}
                  onChange={(event) => setPreferences((value) => ({ ...value, digest_time: event.target.value }))}
                  className={inputClass}
                />
              </label>
            ) : null}
          </div>

          <button type="submit" disabled={savingPreferences} className={`${primaryButtonClass} mt-5 w-full justify-center`}>
            {savingPreferences ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save reminder settings
          </button>
        </form>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-slate-100">Recent notifications</h2>
          <p className="mt-1 text-sm text-slate-400">{data.unreadCount} unread</p>
          {data.notifications.length ? (
            <div className="mt-4 space-y-2">
              {data.notifications.slice(0, 10).map((notification) => (
                <div key={notification.id} className={`rounded-2xl border p-4 ${notification.read_at ? "border-white/10" : "border-cyan-300/20 bg-white/[0.04]"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-white/[0.07]" : "bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)]"}`} />
                    <div className="min-w-0 flex-1">
                      <strong className="text-sm text-slate-100">{notification.title}</strong>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{notification.message}</p>
                      <p className="mt-2 text-[11px] text-slate-500">{formatDateTime(notification.created_at)}</p>
                    </div>
                    {notification.assignment_id ? (
                      <Link href={`/dashboard/assignments/${notification.assignment_id}`} className="text-xs font-semibold text-cyan-300 hover:underline">Open</Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BellRing} title="No reminders created" copy="Run automation after adding deadlines to create reminder notifications." />
          )}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-slate-100">Automation history</h2>
          <p className="mt-1 text-sm text-slate-400">Recent manual and scheduled processing.</p>
          {data.recentAutomationRuns.length ? (
            <div className="mt-4 space-y-2">
              {data.recentAutomationRuns.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 p-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/[0.05] text-slate-400"><RefreshCw className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm capitalize text-slate-100">{run.run_source} run</strong>
                    <span className="text-xs text-slate-400">{formatDateTime(run.started_at)}</span>
                  </div>
                  <div className="text-right text-xs leading-5 text-slate-400">
                    <div>{run.reminders_created} reminders</div>
                    <div>{run.emails_requested} emails</div>
                    <div>{run.recurrences_created} recurrences</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={RefreshCw} title="No automation runs" copy="Use Run reminders now or deploy the included Vercel Cron configuration." />
          )}
        </div>
      </section>

      {templateFormOpen ? (
        <TemplateDialog
          template={editingTemplate}
          subjects={subjects}
          onClose={() => {
            setTemplateFormOpen(false);
            setEditingTemplate(null);
          }}
        />
      ) : null}
    </main>
  );
}

function TemplateCard({
  template,
  subject,
  onEdit,
}: {
  template: AssignmentTemplate;
  subject: AssignmentSubject | null;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function createAssignment() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assignments/templates/${template.id}/use`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Assignment could not be created.");
      router.push(`/dashboard/assignments/${payload.id}`);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Assignment could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate() {
    if (busy || !window.confirm(`Delete the template “${template.name}”?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assignments/templates/${template.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Template could not be deleted.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Template could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article layout className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4 transition hover:border-cyan-300/20 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Sparkles className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-100">{template.name}</h3>
          <p className="mt-1 truncate text-sm text-slate-400">{template.title}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1">Due +{template.due_offset_days} days</span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1">{recurrenceLabel(template.recurrence)}</span>
        {subject ? <span className="rounded-full bg-white/[0.05] px-2.5 py-1">{subject.name}</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={createAssignment} disabled={busy} className={primaryButtonClass}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Use template</button>
        <button type="button" onClick={onEdit} disabled={busy} className={secondaryButtonClass}>Edit</button>
        <button type="button" onClick={removeTemplate} disabled={busy} className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-300/25 px-4 text-sm font-semibold text-red-300 hover:bg-red-400/10"><Trash2 className="size-4" />Delete</button>
      </div>
    </motion.article>
  );
}

function TemplateDialog({
  template,
  subjects,
  onClose,
}: {
  template: AssignmentTemplate | null;
  subjects: AssignmentSubject[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [priority, setPriority] = useState(template?.priority ?? "medium");
  const [recurrence, setRecurrence] = useState(template?.recurrence ?? "");
  const [subjectId, setSubjectId] = useState(template?.subject_id ? String(template.subject_id) : "");
  const [dueTime, setDueTime] = useState(template?.due_time ?? "");
  const [dueOffsetDays, setDueOffsetDays] = useState(String(template?.due_offset_days ?? 7));
  const [reminder, setReminder] = useState(String(template?.reminder_minutes_before ?? 1440));
  const [linkUrl, setLinkUrl] = useState(template?.link_url ?? "");
  const [busy, setBusy] = useState(false);
  const payload = useMemo(() => ({ name, title, description, priority, recurrence, subjectId, dueTime, dueOffsetDays, reminderMinutesBefore: reminder, linkUrl }), [name, title, description, priority, recurrence, subjectId, dueTime, dueOffsetDays, reminder, linkUrl]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(template ? `/api/assignments/templates/${template.id}` : "/api/assignments/templates", {
        method: template ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Template could not be saved.");
      onClose();
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Template could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
      <div className="tech-modal-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-3 sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="tech-modal-surface max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-[28px] border">
        <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/10 bg-[#0b1220]/95 p-5 backdrop-blur sm:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Sparkles className="size-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-100">{template ? "Edit template" : "New assignment template"}</h2><p className="mt-1 text-sm text-slate-400">New assignments calculate their deadline from the due offset.</p></div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"><X className="size-5" /></button>
        </header>
        <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
          <Field label="Template name"><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputClass} /></Field>
          <Field label="Assignment title"><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} className={inputClass} /></Field>
          <Field label="Description" className="md:col-span-2"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} min-h-24 py-3`} /></Field>
          <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")} className={inputClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
          <Field label="Repeat schedule"><select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputClass}><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option></select></Field>
          <Field label="Subject"><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}><option value="">General</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field>
          <Field label="Due offset (days)"><input type="number" min={0} max={3650} value={dueOffsetDays} onChange={(e) => setDueOffsetDays(e.target.value)} className={inputClass} /></Field>
          <Field label="Due time"><input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={inputClass} /></Field>
          <Field label="Reminder"><select value={reminder} onChange={(e) => setReminder(e.target.value)} className={inputClass}><option value="0">At deadline</option><option value="60">1 hour before</option><option value="180">3 hours before</option><option value="1440">1 day before</option><option value="2880">2 days before</option><option value="10080">1 week before</option></select></Field>
          <Field label="Reference link" className="md:col-span-2"><input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className={inputClass} /></Field>
        </div>
        <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-white/10 bg-[#0b1220]/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButtonClass}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{template ? "Save template" : "Create template"}</button>
        </footer>
      </motion.form>
      </div>
    </ModalPortal>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return <div className="rounded-[20px] border border-white/10 bg-white/[0.045] p-4"><Icon className="size-5 text-cyan-300" /><strong className="mt-4 block text-2xl font-semibold text-slate-100">{value}</strong><span className="mt-1 block text-xs text-slate-400">{label}</span></div>;
}
function Insight({ label, value, icon: Icon, danger = false }: { label: string; value: string | number; icon: typeof Clock3; danger?: boolean }) {
  return <div className="flex items-center gap-4 rounded-[20px] border border-white/10 bg-white/[0.045] p-4 shadow-sm"><span className={`grid size-11 place-items-center rounded-2xl ${danger ? "bg-red-400/10 text-red-300" : "bg-cyan-400/10 text-cyan-300"}`}><Icon className="size-5" /></span><div><strong className="block text-xl text-slate-100">{value}</strong><span className="text-xs text-slate-400">{label}</span></div></div>;
}
function ToggleRow({ label, description, checked, onChange, action }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; action?: React.ReactNode }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-white/10 p-3"><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)]" : "bg-white/10"}`}><span className={`absolute top-1 size-4 rounded-full bg-white/[0.045] shadow transition ${checked ? "left-6" : "left-1"}`} /></button><div className="min-w-0 flex-1"><strong className="block text-sm text-slate-100">{label}</strong><p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>{action ? <div className="mt-1">{action}</div> : null}</div></div>;
}
function EmptyState({ icon: Icon, title, copy }: { icon: typeof Sparkles; title: string; copy: string }) {
  return <div className="mt-5 grid min-h-48 place-items-center rounded-[20px] border border-dashed border-cyan-300/20 p-6 text-center"><div><Icon className="mx-auto size-7 text-cyan-300" /><h3 className="mt-3 font-semibold text-slate-100">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">{copy}</p></div></div>;
}
function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={`block ${className}`}><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date); }

const inputClass = "min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/15";
const primaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-60";
