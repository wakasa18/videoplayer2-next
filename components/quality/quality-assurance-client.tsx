"use client";

import {
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Gauge,
  History,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  QualityCheck,
  QualityPageData,
  QualityReport,
  QualityStatus,
} from "@/lib/quality/types";

const groupMeta: Record<
  QualityCheck["group"],
  { label: string; icon: typeof ShieldCheck }
> = {
  security: { label: "Security", icon: ShieldCheck },
  database: { label: "Database", icon: Database },
  storage: { label: "Storage", icon: Database },
  automation: { label: "Automation", icon: RefreshCw },
  performance: { label: "Performance", icon: Gauge },
  accessibility: { label: "Accessibility", icon: Accessibility },
};

export function QualityAssuranceClient({ initialData }: { initialData: QualityPageData }) {
  const router = useRouter();
  const [report, setReport] = useState(initialData.report);
  const [history, setHistory] = useState(initialData.history);
  const [running, setRunning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState(initialData.persistenceMessage ?? "");

  const groups = useMemo(() => {
    return Object.entries(groupMeta).map(([key, meta]) => ({
      key: key as QualityCheck["group"],
      ...meta,
      checks: report.checks.filter((check) => check.group === key),
    }));
  }, [report.checks]);

  async function runQualityChecks() {
    if (running) return;
    setRunning(true);
    setMessage("Running automated quality checks...");
    try {
      const response = await fetch("/api/quality/run", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        report?: QualityReport;
        persisted?: boolean;
        runId?: number | null;
        persistenceError?: string | null;
      };
      if (!response.ok || !payload.report) {
        throw new Error(payload.error ?? "Quality checks could not be completed.");
      }
      setReport(payload.report);
      setMessage(
        payload.persisted
          ? `Quality run saved. Score: ${payload.report.score}/100.`
          : `Quality checks finished, but history was not saved: ${payload.persistenceError ?? "unknown database error"}`,
      );
      router.refresh();
      if (payload.persisted && payload.runId) {
        setHistory((current) => [
          {
            id: payload.runId!,
            status: payload.report!.overall,
            score: payload.report!.score,
            summary: payload.report!.summary,
            createdAt: payload.report!.generatedAt,
          },
          ...current.filter((item) => item.id !== payload.runId).slice(0, 11),
        ]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Quality checks failed.");
    } finally {
      setRunning(false);
    }
  }

  async function clearHistory() {
    if (clearing || !history.length) return;
    if (!window.confirm("Clear saved Phase 11 QA history? This does not affect application data.")) return;
    setClearing(true);
    setMessage("Clearing QA history...");
    try {
      const response = await fetch("/api/quality/run", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; deleted?: number };
      if (!response.ok) throw new Error(payload.error ?? "QA history could not be cleared.");
      setHistory([]);
      setMessage(`Cleared ${payload.deleted ?? 0} saved QA run(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QA history could not be cleared.");
    } finally {
      setClearing(false);
    }
  }

  function downloadReport() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `damons-archive-phase11-qa-${new Date(report.generatedAt).toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="QA score" value={`${report.score}/100`} status={report.overall} />
        <SummaryCard label="Passed" value={String(report.counts.pass)} status="pass" />
        <SummaryCard label="Warnings" value={String(report.counts.warn)} status={report.counts.warn ? "warn" : "pass"} />
        <SummaryCard label="Failed" value={String(report.counts.fail)} status={report.counts.fail ? "fail" : "pass"} />
        <SummaryCard label="Run time" value={`${report.totalDurationMs} ms`} status={report.totalDurationMs > 10000 ? "warn" : "pass"} />
      </section>

      <section className="tech-panel rounded-[24px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <StatusIcon status={report.overall} size="large" />
              <div>
                <h2 className="text-xl font-semibold text-slate-100">Automated release assessment</h2>
                <p className="mt-1 text-sm text-slate-400">{report.summary}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Release {report.release} · Checked {formatDate(report.generatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadReport} className={secondaryButtonClass}>
              <Download className="size-4" /> Export report
            </button>
            <button type="button" onClick={runQualityChecks} disabled={running} className={primaryButtonClass}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Run QA suite
            </button>
          </div>
        </div>
        <p aria-live="polite" className="mt-4 min-h-6 text-sm text-cyan-200/80">
          {message}
        </p>
      </section>

      <section className="space-y-4">
        {groups.map((group) => {
          const Icon = group.icon;
          if (!group.checks.length) return null;
          return (
            <article key={group.key} className="tech-panel rounded-[24px] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-200">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{group.label}</h2>
                  <p className="text-sm text-slate-500">{group.checks.length} automated check{group.checks.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {group.checks.map((check) => (
                  <div key={check.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start gap-3">
                      <StatusIcon status={check.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-slate-100">{check.label}</h3>
                          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-semibold text-slate-500">
                            {check.durationMs} ms
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{check.summary}</p>
                        {check.detail ? (
                          <p className="mt-2 break-words rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-xs leading-5 text-slate-500">
                            {check.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <section className="tech-panel rounded-[24px] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-indigo-400/10 text-indigo-300">
              <Gauge className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Real-user Web Vitals</h2>
              <p className="text-sm text-slate-500">Seven-day p75 performance from authenticated dashboard visits.</p>
            </div>
          </div>
          {report.metrics.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.metrics.map((metric) => (
                <article key={metric.name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">{metric.name}</span>
                    <StatusIcon status={metric.rating} />
                  </div>
                  <strong className="mt-3 block text-2xl font-semibold text-slate-100">
                    {formatMetric(metric.p75, metric.unit)}
                  </strong>
                  <p className="mt-1 text-xs text-slate-500">p75 · {metric.samples} sample{metric.samples === 1 ? "" : "s"}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm leading-6 text-slate-400">
              No performance samples yet. Visit several dashboard pages in production, then run the QA suite again.
            </div>
          )}
        </section>

        <section className="tech-panel rounded-[24px] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-violet-400/10 text-violet-300">
                <History className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">QA history</h2>
                <p className="text-sm text-slate-500">Last 12 saved runs</p>
              </div>
            </div>
            <button type="button" onClick={clearHistory} disabled={clearing || !history.length} className={iconButtonClass} aria-label="Clear QA history">
              {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {history.length ? history.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-slate-200">Score {item.score}/100</strong>
                    <span className="text-[11px] text-slate-500">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm text-slate-500">
                No saved QA runs yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="tech-panel rounded-[24px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Manual final sign-off</h2>
        <p className="mt-1 text-sm text-slate-500">Automated checks cannot fully replace these real-user tests.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Chrome, Edge, Firefox, and mobile browser smoke test",
            "Keyboard-only navigation and visible focus test",
            "File upload interruption and retry test",
            "Large video upload, playback, seeking, and download test",
            "Public shared-link preview and ZIP-download test",
            "Backup download and restore rehearsal",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-300" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, status }: { label: string; value: string; status: QualityStatus }) {
  return (
    <article className="tech-panel rounded-[22px] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <StatusIcon status={status} />
      </div>
      <strong className="mt-3 block text-2xl font-semibold tracking-[-.02em] text-slate-100">{value}</strong>
    </article>
  );
}

function StatusIcon({ status, size = "normal" }: { status: QualityStatus; size?: "normal" | "large" }) {
  const className = size === "large" ? "size-7 shrink-0" : "size-5 shrink-0";
  if (status === "pass") return <CheckCircle2 className={`${className} text-emerald-300`} aria-label="Passed" />;
  if (status === "warn") return <AlertTriangle className={`${className} text-amber-300`} aria-label="Warning" />;
  if (status === "skip") return <Clock3 className={`${className} text-slate-500`} aria-label="Not enough data" />;
  return <XCircle className={`${className} text-red-300`} aria-label="Failed" />;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(date);
}

function formatMetric(value: number, unit: "ms" | "score") {
  return unit === "ms" ? `${Math.round(value)} ms` : value.toFixed(3);
}

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#24d6ff,#4f68ff)] px-5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,255,.2)] transition hover:brightness-110 disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]";
const iconButtonClass =
  "grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-40";
