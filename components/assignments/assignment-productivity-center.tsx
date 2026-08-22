"use client";

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
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Save,
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

  async function runAutomation() {
    if (running) return;
    setRunning(true);
    setRunMessage("");
    try {
      const response = await fetch("/api/assignments/automation", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Automation could not run.");
      setRunMessage(
        `${payload.remindersCreated ?? 0} reminders · ${payload.recurrencesCreated ?? 0} recurring tasks created`,
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
        className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#1967d2]">
              <Sparkles className="size-4" /> Phase 5C · Automation and productivity
            </div>
            <h1 className="text-3xl font-semibold tracking-[-.04em] text-[#202124] sm:text-4xl">
              Assignment productivity
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6368] sm:text-base">
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
              <p className="mt-3 rounded-2xl bg-[#f1f3f4] px-4 py-3 text-sm text-[#3c4043]">{runMessage}</p>
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
        <div className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.08em] text-[#80868b]">Reusable workflows</p>
              <h2 className="mt-1 text-xl font-semibold text-[#202124]">Assignment templates</h2>
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

        <form onSubmit={savePreferences} className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
              <BellRing className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-[#202124]">Reminder settings</h2>
              <p className="mt-1 text-sm leading-6 text-[#5f6368]">Times use the Philippine timezone.</p>
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
                <button type="button" onClick={enableBrowserNotifications} className="text-xs font-semibold text-[#1967d2] hover:underline">
                  Request permission
                </button>
              }
            />
            <ToggleRow
              label="Email reminders"
              description="Send through the configured server email webhook."
              checked={preferences.email_enabled}
              onChange={(checked) => setPreferences((value) => ({ ...value, email_enabled: checked }))}
            />
            {preferences.email_enabled ? (
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#5f6368]">Reminder email</span>
                <input
                  type="email"
                  value={preferences.email_address ?? ""}
                  onChange={(event) => setPreferences((value) => ({ ...value, email_address: event.target.value }))}
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </label>
            ) : null}
            <ToggleRow
              label="Daily digest"
              description="Create one summary for due-today and overdue work."
              checked={preferences.daily_digest_enabled}
              onChange={(checked) => setPreferences((value) => ({ ...value, daily_digest_enabled: checked }))}
            />
            {preferences.daily_digest_enabled ? (
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#5f6368]">Digest time</span>
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
        <div className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-[#202124]">Recent notifications</h2>
          <p className="mt-1 text-sm text-[#80868b]">{data.unreadCount} unread</p>
          {data.notifications.length ? (
            <div className="mt-4 space-y-2">
              {data.notifications.slice(0, 10).map((notification) => (
                <div key={notification.id} className={`rounded-2xl border p-4 ${notification.read_at ? "border-[#eef1f3]" : "border-[#d2e3fc] bg-[#f6f9fe]"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-[#dadce0]" : "bg-[#1a73e8]"}`} />
                    <div className="min-w-0 flex-1">
                      <strong className="text-sm text-[#202124]">{notification.title}</strong>
                      <p className="mt-1 text-xs leading-5 text-[#5f6368]">{notification.message}</p>
                      <p className="mt-2 text-[11px] text-[#9aa0a6]">{formatDateTime(notification.created_at)}</p>
                    </div>
                    {notification.assignment_id ? (
                      <Link href={`/dashboard/assignments/${notification.assignment_id}`} className="text-xs font-semibold text-[#1967d2] hover:underline">Open</Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BellRing} title="No reminders created" copy="Run automation after adding deadlines to create reminder notifications." />
          )}
        </div>

        <div className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-[#202124]">Automation history</h2>
          <p className="mt-1 text-sm text-[#80868b]">Recent manual and scheduled processing.</p>
          {data.recentAutomationRuns.length ? (
            <div className="mt-4 space-y-2">
              {data.recentAutomationRuns.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#eef1f3] p-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#f1f3f4] text-[#5f6368]"><RefreshCw className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm capitalize text-[#202124]">{run.run_source} run</strong>
                    <span className="text-xs text-[#80868b]">{formatDateTime(run.started_at)}</span>
                  </div>
                  <div className="text-right text-xs leading-5 text-[#5f6368]">
                    <div>{run.reminders_created} reminders</div>
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
    <motion.article layout className="rounded-[22px] border border-[#e1e5ea] bg-white p-4 transition hover:border-[#d2e3fc] hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><Sparkles className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[#202124]">{template.name}</h3>
          <p className="mt-1 truncate text-sm text-[#5f6368]">{template.title}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#5f6368]">
        <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1">Due +{template.due_offset_days} days</span>
        <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1">{recurrenceLabel(template.recurrence)}</span>
        {subject ? <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1">{subject.name}</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={createAssignment} disabled={busy} className={primaryButtonClass}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Use template</button>
        <button type="button" onClick={onEdit} disabled={busy} className={secondaryButtonClass}>Edit</button>
        <button type="button" onClick={removeTemplate} disabled={busy} className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#f6c7c3] px-4 text-sm font-semibold text-[#c5221f] hover:bg-[#fce8e6]"><Trash2 className="size-4" />Delete</button>
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
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#202124]/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[#e1e5ea] bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-[#eef1f3] bg-white/95 p-5 backdrop-blur sm:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><Sparkles className="size-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-[#202124]">{template ? "Edit template" : "New assignment template"}</h2><p className="mt-1 text-sm text-[#80868b]">New assignments calculate their deadline from the due offset.</p></div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"><X className="size-5" /></button>
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
        <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#eef1f3] bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButtonClass}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{template ? "Save template" : "Create template"}</button>
        </footer>
      </motion.form>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return <div className="rounded-[20px] border border-[#e1e5ea] bg-white p-4"><Icon className="size-5 text-[#1967d2]" /><strong className="mt-4 block text-2xl font-semibold text-[#202124]">{value}</strong><span className="mt-1 block text-xs text-[#80868b]">{label}</span></div>;
}
function Insight({ label, value, icon: Icon, danger = false }: { label: string; value: string | number; icon: typeof Clock3; danger?: boolean }) {
  return <div className="flex items-center gap-4 rounded-[20px] border border-[#e1e5ea] bg-white p-4 shadow-sm"><span className={`grid size-11 place-items-center rounded-2xl ${danger ? "bg-[#fce8e6] text-[#c5221f]" : "bg-[#e8f0fe] text-[#1967d2]"}`}><Icon className="size-5" /></span><div><strong className="block text-xl text-[#202124]">{value}</strong><span className="text-xs text-[#80868b]">{label}</span></div></div>;
}
function ToggleRow({ label, description, checked, onChange, action }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; action?: React.ReactNode }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#eef1f3] p-3"><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#1a73e8]" : "bg-[#bdc1c6]"}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></button><div className="min-w-0 flex-1"><strong className="block text-sm text-[#202124]">{label}</strong><p className="mt-0.5 text-xs leading-5 text-[#80868b]">{description}</p>{action ? <div className="mt-1">{action}</div> : null}</div></div>;
}
function EmptyState({ icon: Icon, title, copy }: { icon: typeof Sparkles; title: string; copy: string }) {
  return <div className="mt-5 grid min-h-48 place-items-center rounded-[20px] border border-dashed border-[#c6dafc] p-6 text-center"><div><Icon className="mx-auto size-7 text-[#1967d2]" /><h3 className="mt-3 font-semibold text-[#202124]">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-[#80868b]">{copy}</p></div></div>;
}
function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={`block ${className}`}><span className="mb-2 block text-xs font-semibold text-[#5f6368]">{label}</span>{children}</label>; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date); }

const inputClass = "min-h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-4 text-sm text-[#202124] outline-none transition focus:border-[#8ab4f8] focus:ring-4 focus:ring-[#e8f0fe]";
const primaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 text-sm font-semibold text-white transition hover:bg-[#1557b0] disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-60";
