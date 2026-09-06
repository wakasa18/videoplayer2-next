"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileCheck2,
  Loader2,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  Save,
  ShieldAlert,
  SkipForward,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  DeploymentDashboardData,
  DeploymentRelease,
  DeploymentReleaseStatus,
  DeploymentSmokeTest,
  DeploymentTestStatus,
} from "@/lib/deployment/types";

export function DeploymentCutoverClient({ data }: { data: DeploymentDashboardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function runAction(label: string, work: () => Promise<void>) {
    setBusy(label);
    setMessage("");
    try {
      await work();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The deployment action failed.");
    } finally {
      setBusy("");
    }
  }

  if (!data.release) {
    return (
      <CreateReleasePanel
        busy={busy}
        message={message}
        onCreate={(payload) =>
          runAction("create", async () => {
            const response = await fetch("/api/deployment/releases", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            await expectSuccess(response, "Release could not be created.");
            setMessage("Phase 9 release created. Complete preflight checks before deployment.");
          })
        }
      />
    );
  }

  const release = data.release;
  const grouped = groupTests(data.tests);
  const percent = data.readiness.requiredTotal
    ? Math.round((data.readiness.requiredPassed / data.readiness.requiredTotal) * 100)
    : 0;

  async function updateRelease(payload: Record<string, unknown>) {
    const response = await fetch(`/api/deployment/releases/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await expectSuccess(response, "Release could not be updated.");
  }

  async function updateTest(test: DeploymentSmokeTest, status: DeploymentTestStatus) {
    let detail = test.detail ?? "";
    if (status === "fail") {
      detail = window.prompt("Describe the failure or blocker:", detail) ?? detail;
    } else if (status === "skipped") {
      detail = window.prompt("Why is this test being skipped?", detail) ?? detail;
    } else if (status === "pass" && detail && !window.confirm("Keep the existing test note?")) {
      detail = "";
    }
    const response = await fetch(
      `/api/deployment/releases/${release.id}/tests/${encodeURIComponent(test.test_key)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, detail }),
      },
    );
    await expectSuccess(response, "Smoke test could not be updated.");
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Release" value={release.release_tag} status={statusTone(release.status)} />
        <SummaryCard label="Cutover status" value={statusLabel(release.status)} status={statusTone(release.status)} />
        <SummaryCard label="Required tests" value={`${data.readiness.requiredPassed}/${data.readiness.requiredTotal}`} status={data.readiness.canGoLive ? "pass" : data.readiness.failedTests ? "fail" : "warn"} />
        <SummaryCard label="System Check" value={data.system.overall === "pass" ? "Ready" : data.system.overall === "warn" ? "Review" : "Blocked"} status={data.system.overall} />
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={release.status} />
              <span className="text-xs font-medium text-slate-400">Created {formatDate(release.created_at)}</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-.02em] text-slate-100">Production release control</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Add the final Vercel URL and commit, move the release through the controlled states, and download the deployment report for your records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/deployment/releases/${release.id}/report`} className={secondaryButton}>
              <Download className="size-4" /> Report
            </a>
            {release.deployment_url ? (
              <a href={release.deployment_url} target="_blank" rel="noreferrer" className={secondaryButton}>
                <ExternalLink className="size-4" /> Open deployment
              </a>
            ) : null}
          </div>
        </div>

        <ReleaseEditor
          release={release}
          disabled={Boolean(busy)}
          onSave={(payload) => runAction("save", async () => { await updateRelease(payload); setMessage("Release details saved."); })}
        />

        <div className="mt-5 rounded-2xl bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold text-slate-200">Required smoke-test progress</span>
            <span className="font-semibold text-cyan-300">{percent}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <ReleaseActions
          release={release}
          canStartDeployment={data.readiness.canStartDeployment}
          canGoLive={data.readiness.canGoLive}
          busy={busy}
          onStatus={(status) => runAction(`status-${status}`, async () => { await updateRelease({ status }); setMessage(`Release changed to ${statusLabel(status)}.`); })}
          onAutomaticChecks={() =>
            runAction("automatic", async () => {
              const response = await fetch(`/api/deployment/releases/${release.id}/automatic-checks`, { method: "POST" });
              const payload = (await expectSuccess(response, "Automatic checks failed.")) as { updated?: number };
              setMessage(`Updated ${payload.updated ?? 0} automatic checks.`);
            })
          }
        />

        {data.readiness.blockers.length ? (
          <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-amber-300"><ShieldAlert className="size-4" /> Launch blockers</div>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-300">
              {data.readiness.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
            </ul>
          </div>
        ) : null}
        <p aria-live="polite" className={`mt-4 text-sm leading-6 ${message.toLowerCase().includes("fail") || message.toLowerCase().includes("could not") ? "text-red-300" : "text-emerald-300"}`}>{message}</p>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Production smoke tests</h2>
            <p className="mt-1 text-sm text-slate-400">Run these against the actual Vercel deployment, not only localhost.</p>
          </div>
          <div className="text-sm text-slate-400">{data.readiness.failedTests} failed · {data.readiness.pendingTests} not run</div>
        </div>
        <div className="mt-5 space-y-5">
          {grouped.map(([category, tests]) => (
            <div key={category}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-slate-400">{category}</h3>
              <div className="space-y-2">
                {tests.map((test) => (
                  <SmokeTestRow
                    key={test.test_key}
                    test={test}
                    disabled={Boolean(busy) || release.status === "live" || release.status === "rolled_back"}
                    onStatus={(status) => runAction(`test-${test.test_key}`, () => updateTest(test, status))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-100">Cutover sequence</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
            <Step number="1" title="Prepare" text="Build locally, run System Check, back up metadata, and configure Vercel and Supabase production settings." />
            <Step number="2" title="Deploy" text="Publish the release to Vercel, record its URL and commit, then change the release status to Deploying." />
            <Step number="3" title="Verify" text="Complete every required smoke test using production data and private Storage access." />
            <Step number="4" title="Cut over" text="Freeze the old system, transfer the final delta, mark the release Live, and direct users to the new domain." />
            <Step number="5" title="Watch" text="Monitor health, cron execution, missing objects, and application errors. Roll back immediately if critical flows fail." />
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-100">Release history</h2>
          {data.events.length ? (
            <ol className="mt-4 space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className="border-l-2 border-cyan-300/20 pl-4">
                  <div className="text-sm font-semibold text-slate-200">{event.message}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(event.created_at)}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No deployment events have been recorded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function CreateReleasePanel({ busy, message, onCreate }: { busy: string; message: string; onCreate: (payload: Record<string, unknown>) => void }) {
  const suggested = useMemo(() => `phase9-${new Date().toISOString().slice(0, 10)}`, []);
  const [releaseTag, setReleaseTag] = useState(suggested);
  const [environment, setEnvironment] = useState("production");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.045] p-6 shadow-sm sm:p-8">
      <span className="grid size-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Rocket className="size-7" /></span>
      <h2 className="mt-5 text-2xl font-semibold text-slate-100">Create the Phase 9 release</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">This creates an owner-scoped cutover record and the full production smoke-test checklist. It does not deploy to Vercel automatically.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Release tag"><input value={releaseTag} onChange={(event) => setReleaseTag(event.target.value)} className={inputClass} /></Field>
        <Field label="Environment"><select value={environment} onChange={(event) => setEnvironment(event.target.value)} className={inputClass}><option value="production">Production</option><option value="preview">Preview</option></select></Field>
        <Field label="Vercel URL (can be added later)"><input value={deploymentUrl} onChange={(event) => setDeploymentUrl(event.target.value)} placeholder="https://your-project.vercel.app" className={inputClass} /></Field>
        <Field label="Commit SHA (optional)"><input value={commitSha} onChange={(event) => setCommitSha(event.target.value)} placeholder="Git commit" className={inputClass} /></Field>
        <div className="md:col-span-2"><Field label="Release notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={inputClass} /></Field></div>
      </div>
      <button type="button" disabled={Boolean(busy) || !releaseTag.trim()} onClick={() => onCreate({ releaseTag, environment, deploymentUrl, commitSha, notes })} className={`${primaryButton} mt-5`}>
        {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Create release
      </button>
      <p aria-live="polite" className="mt-4 text-sm text-slate-400">{message}</p>
    </section>
  );
}

function ReleaseEditor({ release, disabled, onSave }: { release: DeploymentRelease; disabled: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  const [deploymentUrl, setDeploymentUrl] = useState(release.deployment_url ?? "");
  const [commitSha, setCommitSha] = useState(release.commit_sha ?? "");
  const [notes, setNotes] = useState(release.notes ?? "");
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <Field label="Vercel deployment URL"><input value={deploymentUrl} onChange={(event) => setDeploymentUrl(event.target.value)} className={inputClass} placeholder="https://your-project.vercel.app" /></Field>
      <Field label="Commit SHA"><input value={commitSha} onChange={(event) => setCommitSha(event.target.value)} className={inputClass} placeholder="Git commit" /></Field>
      <div className="md:col-span-2"><Field label="Release notes"><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} /></Field></div>
      <div className="md:col-span-2"><button type="button" disabled={disabled || release.status === "live"} onClick={() => onSave({ deploymentUrl, commitSha, notes })} className={secondaryButton}><Save className="size-4" /> Save release details</button></div>
    </div>
  );
}

function ReleaseActions({ release, canStartDeployment, canGoLive, busy, onStatus, onAutomaticChecks }: { release: DeploymentRelease; canStartDeployment: boolean; canGoLive: boolean; busy: string; onStatus: (status: DeploymentReleaseStatus) => void; onAutomaticChecks: () => void }) {
  const status = release.status;
  return (
    <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5">
      {status !== "live" && status !== "rolled_back" ? <button type="button" disabled={Boolean(busy)} onClick={onAutomaticChecks} className={secondaryButton}>{busy === "automatic" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Run automatic checks</button> : null}
      {status === "draft" ? <button type="button" disabled={Boolean(busy) || !canStartDeployment} onClick={() => onStatus("ready")} className={primaryButton}><FileCheck2 className="size-4" /> Mark ready</button> : null}
      {status === "ready" ? <><button type="button" disabled={Boolean(busy)} onClick={() => onStatus("draft")} className={secondaryButton}><RotateCcw className="size-4" /> Back to draft</button><button type="button" disabled={Boolean(busy) || !canStartDeployment} onClick={() => onStatus("deploying")} className={primaryButton}><Play className="size-4" /> Start deployment</button></> : null}
      {status === "deploying" ? <><button type="button" disabled={Boolean(busy) || !canGoLive} title={!canGoLive ? "Pass all required tests first" : undefined} onClick={() => onStatus("live")} className={successButton}><Rocket className="size-4" /> Mark live</button><button type="button" disabled={Boolean(busy)} onClick={() => onStatus("failed")} className={dangerButton}><XCircle className="size-4" /> Mark failed</button><button type="button" disabled={Boolean(busy)} onClick={() => onStatus("rolled_back")} className={secondaryButton}><RotateCcw className="size-4" /> Roll back</button></> : null}
      {status === "live" ? <button type="button" disabled={Boolean(busy)} onClick={() => window.confirm("Roll back this live release?") && onStatus("rolled_back")} className={dangerButton}><RotateCcw className="size-4" /> Record rollback</button> : null}
      {status === "failed" || status === "rolled_back" ? <button type="button" disabled={Boolean(busy)} onClick={() => onStatus("ready")} className={primaryButton}><RefreshCw className="size-4" /> Prepare retry</button> : null}
      {(status === "draft" || status === "ready") ? <button type="button" disabled={Boolean(busy)} onClick={() => onStatus("failed")} className={dangerButton}><X className="size-4" /> Cancel as failed</button> : null}
    </div>
  );
}

function SmokeTestRow({ test, disabled, onStatus }: { test: DeploymentSmokeTest; disabled: boolean; onStatus: (status: DeploymentTestStatus) => void }) {
  return (
    <article className="rounded-2xl border border-white/10 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <TestIcon status={test.status} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-100">{test.label}</h4>{test.required ? <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">Required</span> : <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-slate-400">Optional</span>}</div>
            {test.detail ? <p className="mt-1 text-sm leading-6 text-slate-400">{test.detail}</p> : null}
            {test.checked_at ? <p className="mt-1 text-xs text-slate-500">Updated {formatDate(test.checked_at)}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <TestButton label="Pass" active={test.status === "pass"} disabled={disabled} onClick={() => onStatus("pass")} icon={Check} />
          <TestButton label="Fail" active={test.status === "fail"} disabled={disabled} onClick={() => onStatus("fail")} icon={X} danger />
          {!test.required ? <TestButton label="Skip" active={test.status === "skipped"} disabled={disabled} onClick={() => onStatus("skipped")} icon={SkipForward} /> : null}
          {test.status !== "not_run" ? <TestButton label="Reset" active={false} disabled={disabled} onClick={() => onStatus("not_run")} icon={RotateCcw} /> : null}
        </div>
      </div>
    </article>
  );
}

function TestButton({ label, active, disabled, onClick, icon: Icon, danger = false }: { label: string; active: boolean; disabled: boolean; onClick: () => void; icon: typeof Check; danger?: boolean }) {
  const activeClass = danger ? "border-red-300/25 bg-red-400/10 text-red-300" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-300";
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${active ? activeClass : "border-white/10 bg-white/[0.045] text-slate-400 hover:bg-white/[0.06]"}`}><Icon className="size-3.5" />{label}</button>;
}

function SummaryCard({ label, value, status }: { label: string; value: string; status: "pass" | "warn" | "fail" }) {
  return <article className="rounded-[22px] border border-white/10 bg-white/[0.045] p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-400">{label}</span>{status === "pass" ? <CheckCircle2 className="size-5 text-emerald-300" /> : status === "warn" ? <AlertTriangle className="size-5 text-amber-300" /> : <XCircle className="size-5 text-red-300" />}</div><strong className="mt-3 block truncate text-2xl font-semibold tracking-[-.02em] text-slate-100" title={value}>{value}</strong></article>;
}

function StatusBadge({ status }: { status: DeploymentReleaseStatus }) {
  const styles: Record<DeploymentReleaseStatus, string> = { draft: "bg-white/[0.05] text-slate-400", ready: "bg-cyan-400/10 text-cyan-300", deploying: "bg-amber-400/10 text-amber-300", live: "bg-emerald-400/10 text-emerald-300", failed: "bg-red-400/10 text-red-300", rolled_back: "bg-purple-400/10 text-purple-300" };
  return <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${styles[status]}`}>{statusLabel(status)}</span>;
}

function TestIcon({ status }: { status: DeploymentTestStatus }) {
  if (status === "pass") return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />;
  if (status === "fail") return <XCircle className="mt-0.5 size-5 shrink-0 text-red-300" />;
  if (status === "skipped") return <SkipForward className="mt-0.5 size-5 shrink-0 text-purple-300" />;
  return <Circle className="mt-0.5 size-5 shrink-0 text-slate-500" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-200">{label}</span>{children}</label>; }
function Step({ number, title, text }: { number: string; title: string; text: string }) { return <div className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-400/10 text-xs font-bold text-cyan-300">{number}</span><div><div className="font-semibold text-slate-100">{title}</div><p className="text-slate-400">{text}</p></div></div>; }

function groupTests(tests: DeploymentSmokeTest[]): Array<[string, DeploymentSmokeTest[]]> {
  const map = new Map<string, DeploymentSmokeTest[]>();
  for (const test of tests) map.set(test.category, [...(map.get(test.category) ?? []), test]);
  return Array.from(map.entries());
}
function statusTone(status: DeploymentReleaseStatus): "pass" | "warn" | "fail" { if (status === "live") return "pass"; if (status === "failed" || status === "rolled_back") return "fail"; return "warn"; }
function statusLabel(status: DeploymentReleaseStatus): string { return status.replace("_", " ").replace(/\b\w/g, (value) => value.toUpperCase()); }
function formatDate(value: string | null): string { if (!value) return "Unknown"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date); }
async function expectSuccess(response: Response, fallback: string): Promise<unknown> { const payload = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) throw new Error(payload.error ?? fallback); return payload; }

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50";
const successButton = "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButton = "inline-flex items-center justify-center gap-2 rounded-full border border-red-300/25 bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50";
