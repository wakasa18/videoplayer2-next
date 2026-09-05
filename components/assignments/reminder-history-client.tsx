"use client";

import { AlertTriangle, BellRing, CheckCircle2, Clock3, Loader2, Mail, RefreshCw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AutomationRunItem, ReminderHistoryItem } from "@/lib/assignments/reminder-history";

export function ReminderHistoryClient({ data }: { data: { items: ReminderHistoryItem[]; runs: AutomationRunItem[]; sent: number; failed: number; pending: number; lastCronRun: AutomationRunItem | null } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function runNow() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/assignments/automation", { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not run reminder automation.");
      router.refresh();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not run reminder automation."); }
    finally { setBusy(false); }
  }
  return <main className="space-y-5">
    <section className="tech-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8"><div className="tech-scanline" /><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300"><BellRing className="size-4" /> Reminder delivery center</div><h1 className="mt-4 text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">Reminder History</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Review assignment reminder delivery, Gmail SMTP failures, retries, and recent cron runs.</p></div><button onClick={runNow} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Run check now</button></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Email sent" value={data.sent} icon={CheckCircle2} /><Stat label="Failed" value={data.failed} icon={XCircle} danger={data.failed > 0} /><Stat label="Pending / retrying" value={data.pending} icon={Clock3} /><Stat label="Last cron" value={data.lastCronRun ? formatWhen(data.lastCronRun.started_at) : "No run"} icon={RefreshCw} /></div>
    {data.failed ? <div className="flex gap-3 rounded-2xl border border-red-300/20 bg-red-400/[.08] p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>{data.failed} email reminder{data.failed === 1 ? "" : "s"} failed. The next due automation run can retry unsent reminders; use the error details below to verify Gmail SMTP configuration.</p></div> : null}
    <section className="tech-panel overflow-hidden rounded-[24px]"><header className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold text-slate-100">Delivery log</h2><p className="mt-1 text-xs text-slate-500">Newest notification records first</p></header><div className="divide-y divide-white/[.07]">{data.items.length ? data.items.map((item) => <ReminderRow key={item.id} item={item} />) : <p className="p-6 text-sm text-slate-500">No reminder history yet.</p>}</div></section>
    <section className="tech-panel overflow-hidden rounded-[24px]"><header className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold text-slate-100">Automation runs</h2></header><div className="divide-y divide-white/[.07]">{data.runs.slice(0, 12).map((run) => <div key={String(run.id)} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_auto]"><div><strong className="text-slate-200">{run.run_source === "cron" ? "Scheduled cron" : "Manual check"}</strong><p className="mt-1 text-xs text-slate-500">{formatDateTime(run.started_at)} · {run.emails_requested} email{run.emails_requested === 1 ? "" : "s"} · {run.reminders_created} reminder{run.reminders_created === 1 ? "" : "s"}</p></div><span className={`self-start rounded-full px-2.5 py-1 text-[10px] font-semibold ${run.errors?.length ? "bg-red-400/10 text-red-300" : "bg-emerald-400/10 text-emerald-300"}`}>{run.errors?.length ? `${run.errors.length} error${run.errors.length === 1 ? "" : "s"}` : "Healthy"}</span></div>)}</div></section>
  </main>;
}

function ReminderRow({ item }: { item: ReminderHistoryItem }) {
  const status = item.email_status || (item.emailed_at ? "sent" : "in-app");
  const Icon = status === "sent" ? CheckCircle2 : status === "failed" ? XCircle : status === "pending" || status === "retrying" ? Clock3 : Mail;
  const cls = status === "sent" ? "text-emerald-300 bg-emerald-400/10" : status === "failed" ? "text-red-300 bg-red-400/10" : "text-cyan-300 bg-cyan-400/10";
  return <div className="flex items-start gap-3 px-5 py-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${cls}`}><Icon className="size-4.5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-slate-200">{item.title}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{status}</span>{item.email_attempts > 1 ? <span className="text-[10px] text-slate-500">{item.email_attempts} attempts</span> : null}</div><p className="mt-1 text-xs leading-5 text-slate-500">{item.message}</p>{item.email_error ? <p className="mt-2 rounded-lg bg-red-400/[.07] px-2.5 py-2 text-xs text-red-300">{item.email_error}</p> : null}</div><time className="hidden shrink-0 text-[10px] text-slate-600 sm:block">{formatDateTime(item.email_last_attempt_at || item.emailed_at || item.created_at)}</time></div>;
}

function Stat({ label, value, icon: Icon, danger = false }: { label: string; value: number | string; icon: typeof Mail; danger?: boolean }) { return <div className="tech-panel rounded-[20px] p-4"><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${danger ? "bg-red-400/10 text-red-300" : "bg-cyan-400/10 text-cyan-300"}`}><Icon className="size-4.5" /></span><div><p className="text-xs text-slate-500">{label}</p><strong className="mt-0.5 block text-lg font-semibold text-slate-100">{value}</strong></div></div></div>; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
function formatWhen(value: string) { const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000)); return minutes < 1 ? "Now" : `${minutes}m ago`; }
