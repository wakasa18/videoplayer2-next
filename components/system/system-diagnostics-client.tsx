"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  DiagnosticStatus,
  SystemDiagnosticsData,
} from "@/lib/system/types";

export function SystemDiagnosticsClient({ data }: { data: SystemDiagnosticsData }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [automation, setAutomation] = useState("");
  const [cleaning, setCleaning] = useState(false);

  async function refresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 700);
  }

  async function runAutomation() {
    setAutomation("Running assignment automation...");
    try {
      const response = await fetch("/api/assignments/automation", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        remindersCreated?: number;
        recurrencesCreated?: number;
        emailsRequested?: number;
      };
      if (!response.ok) throw new Error(payload.error ?? "Automation failed.");
      setAutomation(
        `Automation completed: ${payload.remindersCreated ?? 0} reminder(s), ${payload.recurrencesCreated ?? 0} recurrence(s), and ${payload.emailsRequested ?? 0} email request(s).`,
      );
      router.refresh();
    } catch (error) {
      setAutomation(error instanceof Error ? error.message : "Automation failed.");
    }
  }

  async function cleanOldErrors() {
    setCleaning(true);
    try {
      const response = await fetch("/api/system/errors", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; deleted?: number };
      if (!response.ok) throw new Error(payload.error ?? "Cleanup failed.");
      setAutomation(`Removed ${payload.deleted ?? 0} error report(s) older than 90 days.`);
      router.refresh();
    } catch (error) {
      setAutomation(error instanceof Error ? error.message : "Cleanup failed.");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Overall status" value={statusLabel(data.overall)} status={data.overall} />
        <SummaryCard label="Release" value={`Phase ${data.release}`} status="pass" />
        <SummaryCard
          label="Storage audit"
          value={`${data.storageAudit.checkedFiles + data.storageAudit.checkedVideos} checked`}
          status={data.storageAudit.missingFiles + data.storageAudit.missingVideos ? "warn" : "pass"}
        />
        <SummaryCard
          label="Recent errors"
          value={String(data.recentErrors.length)}
          status={data.recentErrors.length ? "warn" : "pass"}
        />
      </section>

      <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#202124]">Production checks</h2>
            <p className="mt-1 text-sm text-[#5f6368]">
              Last checked {formatDate(data.checkedAt)}. Storage checks sample the newest active records.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1967d2] disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Run checks again
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {data.checks.map((check) => (
            <article key={check.id} className="rounded-2xl border border-[#e1e5ea] p-4">
              <div className="flex items-start gap-3">
                <StatusIcon status={check.status} />
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#202124]">{check.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5f6368]">{check.summary}</p>
                  {check.detail ? (
                    <p className="mt-2 break-words rounded-xl bg-[#f8f9fa] px-3 py-2 text-xs leading-5 text-[#5f6368]">
                      {check.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
        <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-[#202124]">Environment configuration</h2>
          <p className="mt-1 text-sm text-[#5f6368]">Secret values are never displayed.</p>
          <div className="mt-5 space-y-2">
            {data.environment.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-4 rounded-2xl bg-[#f8f9fa] px-4 py-3">
                <div className="min-w-0">
                  <code className="break-all text-xs font-semibold text-[#3c4043]">{item.key}</code>
                  <p className="mt-1 text-xs leading-5 text-[#80868b]">{item.note}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.configured ? "bg-[#e6f4ea] text-[#137333]" : item.required ? "bg-[#fce8e6] text-[#b3261e]" : "bg-[#fef7e0] text-[#b06000]"}`}>
                  {item.configured ? "Configured" : item.required ? "Missing" : "Optional"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[#202124]">Release actions</h2>
            <div className="mt-4 grid gap-3">
              <a href="/api/workspace/export" className={actionClass}>
                <Download className="size-4" /> Download metadata backup
              </a>
              <button type="button" onClick={runAutomation} className={actionClass}>
                <Play className="size-4" /> Run assignment automation
              </button>
              <button type="button" onClick={cleanOldErrors} disabled={cleaning} className={actionClass}>
                {cleaning ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Clean error logs older than 90 days
              </button>
              <a href="/api/health" target="_blank" rel="noreferrer" className={actionClass}>
                <ExternalLink className="size-4" /> Open public health endpoint
              </a>
            </div>
            <p aria-live="polite" className="mt-4 text-sm leading-6 text-[#5f6368]">{automation}</p>
          </section>

          <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[#202124]">Deployment runtime</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Environment" value={data.deployment.environment} />
              <Row label="Node.js" value={data.deployment.node} />
              <Row label="Region" value={data.deployment.region ?? "Local / unknown"} />
              <Row label="Commit" value={data.deployment.commit ?? "Not supplied"} />
              <Row label="App URL" value={data.deployment.appUrl ?? "Not configured"} />
            </dl>
          </section>
        </div>
      </div>

      <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#fce8e6] text-[#b3261e]">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#202124]">Recent error reports</h2>
            <p className="text-sm text-[#5f6368]">Captured by the production application error boundary.</p>
          </div>
        </div>
        {data.recentErrors.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#80868b]">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Path</th>
                </tr>
              </thead>
              <tbody>
                {data.recentErrors.map((item) => (
                  <tr key={item.id} className="border-t border-[#e8eaed] align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-[#5f6368]">{formatDate(item.created_at)}</td>
                    <td className="px-3 py-3 font-medium text-[#3c4043]">{item.source}</td>
                    <td className="max-w-xl px-3 py-3 text-[#3c4043]">{item.message}</td>
                    <td className="max-w-xs break-all px-3 py-3 text-[#5f6368]">{item.path ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-[#e6f4ea] p-4 text-sm text-[#137333]">
            No recent application errors have been reported.
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, status }: { label: string; value: string; status: DiagnosticStatus }) {
  return (
    <article className="rounded-[22px] border border-[#e1e5ea] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#5f6368]">{label}</span>
        <StatusIcon status={status} />
      </div>
      <strong className="mt-3 block text-2xl font-semibold tracking-[-.02em] text-[#202124]">{value}</strong>
    </article>
  );
}

function StatusIcon({ status }: { status: DiagnosticStatus }) {
  if (status === "pass") return <CheckCircle2 className="size-5 shrink-0 text-[#137333]" aria-label="Passed" />;
  if (status === "warn") return <AlertTriangle className="size-5 shrink-0 text-[#b06000]" aria-label="Warning" />;
  return <XCircle className="size-5 shrink-0 text-[#b3261e]" aria-label="Failed" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f1f3f4] pb-3 last:border-0 last:pb-0">
      <dt className="text-[#5f6368]">{label}</dt>
      <dd className="max-w-[65%] break-all text-right font-medium text-[#202124]">{value}</dd>
    </div>
  );
}

function statusLabel(status: DiagnosticStatus): string {
  if (status === "pass") return "Ready";
  if (status === "warn") return "Needs review";
  return "Not ready";
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date);
}

const actionClass = "inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-60";
