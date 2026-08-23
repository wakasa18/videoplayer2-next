"use client";

import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Gauge,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { MaintenanceDashboardData, MaintenanceStatus } from "@/lib/maintenance/types";

export function MaintenanceClient({ data }: { data: MaintenanceDashboardData }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function runMaintenance(cleanup: boolean) {
    setBusy(cleanup ? "cleanup" : "run");
    setMessage(cleanup ? "Cleaning stale records and running checks..." : "Running production checks...");
    try {
      const response = await fetch(cleanup ? "/api/maintenance/cleanup" : "/api/maintenance/run", { method: "POST" });
      const payload = (await response.json()) as { error?: string; report?: { summary?: string; cleanup?: Record<string, number> } };
      if (!response.ok) throw new Error(payload.error ?? "Maintenance failed.");
      setMessage(payload.report?.summary ?? "Maintenance completed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Maintenance failed.");
    } finally {
      setBusy("");
    }
  }

  async function verifyBackup(file: File) {
    setBusy("backup");
    setMessage("Reading and validating backup metadata...");
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Choose a metadata backup smaller than 25 MB.");
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const counts: Record<string, number> = {};
      const sections: string[] = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (Array.isArray(value)) {
          counts[key] = value.length;
          sections.push(key);
        } else if (value && typeof value === "object") {
          sections.push(key);
        }
      }
      const response = await fetch("/api/maintenance/verify-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          schema: parsed.schema,
          version: parsed.version,
          generatedAt: parsed.generated_at,
          counts,
          sections,
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        }),
      });
      const payload = (await response.json()) as { error?: string; verification?: { status?: string; warnings?: string[] } };
      if (!response.ok) throw new Error(payload.error ?? "Backup verification failed.");
      const status = payload.verification?.status ?? "complete";
      const warningCount = payload.verification?.warnings?.length ?? 0;
      setMessage(`Backup verification ${status}${warningCount ? ` with ${warningCount} warning(s)` : ""}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup verification failed.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
      setBusy("");
    }
  }

  const current = data.current;
  const stale = current.records.stalePendingFiles + current.records.stalePendingVideos;
  const missing = current.storage.missingFiles + current.storage.missingVideos;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={ShieldCheck} label="Maintenance status" value={statusLabel(current.status)} status={current.status} />
        <SummaryCard icon={HardDrive} label="Storage used" value={formatBytes(current.storage.totalBytes)} detail={`${current.storage.quotaPercent.toFixed(1)}% of quota`} status={current.storage.quotaPercent >= 100 ? "critical" : current.storage.quotaPercent >= 80 ? "attention" : "healthy"} />
        <SummaryCard icon={Clock3} label="Stale uploads" value={String(stale)} detail="Pending over 24 hours" status={stale ? "attention" : "healthy"} />
        <SummaryCard icon={AlertTriangle} label="Errors in 24 hours" value={String(current.records.errors24h)} detail={`${missing} sampled missing object(s)`} status={current.records.errors24h || missing ? "attention" : "healthy"} />
      </section>

      <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#202124]">Post-launch maintenance</h2>
            <p className="mt-1 text-sm leading-6 text-[#5f6368]">Last checked {formatDate(data.checkedAt)}. Cleanup removes only uploads left pending for more than 24 hours and expired operational logs.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={Boolean(busy)} onClick={() => void runMaintenance(false)} className={primaryButton}>
              {busy === "run" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Run checks
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void runMaintenance(true)} className={secondaryButton}>
              {busy === "cleanup" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Clean stale data
            </button>
          </div>
        </div>
        <p aria-live="polite" className="mt-4 text-sm font-medium text-[#3c4043]">{message}</p>
        {current.warnings.length ? (
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {current.warnings.map((warning) => <div key={warning} className="flex gap-2 rounded-2xl bg-[#fef7e0] p-4 text-sm leading-6 text-[#7a4d00]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{warning}</div>)}
          </div>
        ) : <div className="mt-5 rounded-2xl bg-[#e6f4ea] p-4 text-sm text-[#137333]">No current maintenance warnings.</div>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
        <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]"><Database className="size-5" /></span><div><h2 className="text-lg font-semibold text-[#202124]">Operational snapshot</h2><p className="text-sm text-[#5f6368]">Database, Storage, and error-history totals.</p></div></div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <Stat label="Active files" value={String(current.storage.activeFiles)} />
            <Stat label="Active videos" value={String(current.storage.activeVideos)} />
            <Stat label="File storage" value={formatBytes(current.storage.fileBytes)} />
            <Stat label="Video storage" value={formatBytes(current.storage.videoBytes)} />
            <Stat label="Pending files" value={String(current.records.pendingFiles)} />
            <Stat label="Pending videos" value={String(current.records.pendingVideos)} />
            <Stat label="Errors in 7 days" value={String(current.records.errors7d)} />
            <Stat label="Errors in 30 days" value={String(current.records.errors30d)} />
          </dl>
          <div className="mt-5">
            <div className="flex justify-between text-xs font-medium text-[#5f6368]"><span>Storage quota</span><span>{current.storage.quotaPercent.toFixed(1)}%</span></div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e8eaed]"><div className="h-full rounded-full bg-[#1a73e8]" style={{ width: `${Math.min(100, current.storage.quotaPercent)}%` }} /></div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#f3e8fd] text-[#7b1fa2]"><ArchiveRestore className="size-5" /></span><div><h2 className="text-lg font-semibold text-[#202124]">Backup and recovery</h2><p className="text-sm text-[#5f6368]">Download and verify metadata backups.</p></div></div>
          <div className="mt-5 grid gap-3">
            <a href="/api/workspace/export" className={actionButton}><Download className="size-4" /> Download metadata backup</a>
            <a href="/api/maintenance/report" className={actionButton}><Download className="size-4" /> Download latest maintenance report</a>
            <button type="button" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()} className={actionButton}><Upload className="size-4" /> Verify a backup file</button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void verifyBackup(file); }} />
          </div>
          <div className="mt-5 space-y-2">
            {data.backupVerifications.length ? data.backupVerifications.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-2xl bg-[#f8f9fa] p-3 text-sm"><div className="flex items-center justify-between gap-3"><strong className="truncate text-[#3c4043]">{item.filename}</strong><VerificationBadge status={item.status} /></div><p className="mt-1 text-xs text-[#80868b]">{formatDate(item.verified_at)}</p></div>
            )) : <p className="text-sm text-[#80868b]">No backup has been verified yet.</p>}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><Gauge className="size-5 text-[#1967d2]" /><h2 className="text-lg font-semibold text-[#202124]">Timed checks</h2></div>
          <div className="mt-5 space-y-3">
            {current.timings.map((timing) => <div key={timing.label} className="flex items-center justify-between gap-4 rounded-2xl bg-[#f8f9fa] px-4 py-3"><span className="text-sm font-medium text-[#3c4043]">{timing.label}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${timing.status === "slow" ? "bg-[#fce8e6] text-[#b3261e]" : timing.status === "review" ? "bg-[#fef7e0] text-[#b06000]" : "bg-[#e6f4ea] text-[#137333]"}`}>{timing.milliseconds} ms</span></div>)}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-[#202124]">Recent maintenance runs</h2>
          <div className="mt-5 space-y-3">
            {data.recentRuns.length ? data.recentRuns.map((run) => <div key={run.id} className="rounded-2xl border border-[#e8eaed] p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#202124]">{run.run_type === "cron" ? "Daily automated run" : run.run_type === "cleanup" ? "Manual cleanup" : "Manual check"}</strong><p className="mt-1 text-xs text-[#80868b]">{formatDate(run.created_at)}</p></div><StatusBadge status={run.status} /></div><p className="mt-3 text-sm leading-6 text-[#5f6368]">{run.summary}</p></div>) : <p className="rounded-2xl bg-[#f8f9fa] p-4 text-sm text-[#80868b]">Run the first maintenance check to create history.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, status }: { icon: typeof ShieldCheck; label: string; value: string; detail?: string; status: MaintenanceStatus }) {
  return <article className="rounded-[22px] border border-[#e1e5ea] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><Icon className="size-5 text-[#1967d2]" /><StatusDot status={status} /></div><span className="mt-4 block text-sm font-medium text-[#5f6368]">{label}</span><strong className="mt-1 block text-2xl font-semibold text-[#202124]">{value}</strong>{detail ? <p className="mt-1 text-xs text-[#80868b]">{detail}</p> : null}</article>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#f8f9fa] p-4"><dt className="text-xs font-medium uppercase tracking-wide text-[#80868b]">{label}</dt><dd className="mt-1 text-lg font-semibold text-[#202124]">{value}</dd></div>; }
function StatusDot({ status }: { status: MaintenanceStatus }) { return status === "healthy" ? <CheckCircle2 className="size-5 text-[#137333]" /> : status === "attention" ? <AlertTriangle className="size-5 text-[#b06000]" /> : <XCircle className="size-5 text-[#b3261e]" />; }
function StatusBadge({ status }: { status: MaintenanceStatus }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "healthy" ? "bg-[#e6f4ea] text-[#137333]" : status === "attention" ? "bg-[#fef7e0] text-[#b06000]" : "bg-[#fce8e6] text-[#b3261e]"}`}>{statusLabel(status)}</span>; }
function VerificationBadge({ status }: { status: "pass" | "warn" | "fail" }) { return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status === "pass" ? "bg-[#e6f4ea] text-[#137333]" : status === "warn" ? "bg-[#fef7e0] text-[#b06000]" : "bg-[#fce8e6] text-[#b3261e]"}`}>{status}</span>; }
function statusLabel(status: MaintenanceStatus) { return status === "healthy" ? "Healthy" : status === "attention" ? "Needs review" : "Critical"; }
function formatBytes(bytes: number) { if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`; if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${bytes} B`; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date); }
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1967d2] disabled:opacity-60";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-5 py-2.5 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-60";
const actionButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-60";
