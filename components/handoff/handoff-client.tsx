"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Download,
  FileCheck2,
  Loader2,
  PenLine,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  HandoffChecklistItem,
  HandoffItemStatus,
  HandoffPageData,
} from "@/lib/handoff/types";

const groupLabels: Record<HandoffChecklistItem["group"], string> = {
  acceptance: "User acceptance",
  operations: "Operations and recovery",
  security: "Security and permissions",
  documentation: "Documentation and ownership",
};

export function HandoffClient({ initialData }: { initialData: HandoffPageData }) {
  const [data, setData] = useState(initialData);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [acceptedBy, setAcceptedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const groups = useMemo(
    () =>
      (Object.keys(groupLabels) as HandoffChecklistItem["group"][]).map((group) => ({
        group,
        label: groupLabels[group],
        items: data.items.filter((item) => item.group === group),
      })),
    [data.items],
  );

  async function updateItem(item: HandoffChecklistItem, status: HandoffItemStatus) {
    if (item.automatic || savingKey) return;
    setSavingKey(item.key);
    setMessage("Saving acceptance item...");
    try {
      const response = await fetch("/api/handoff/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key, status, evidence: item.evidence }),
      });
      const payload = (await response.json()) as { error?: string; data?: HandoffPageData };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Acceptance item could not be saved.");
      setData(payload.data);
      setMessage("Acceptance item saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Acceptance item could not be saved.");
    } finally {
      setSavingKey(null);
    }
  }

  async function signOff() {
    if (signing) return;
    setSigning(true);
    setMessage("Saving final acceptance...");
    try {
      const response = await fetch("/api/handoff/signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedBy, notes }),
      });
      const payload = (await response.json()) as { error?: string; data?: HandoffPageData };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Final acceptance could not be saved.");
      setData(payload.data);
      setMessage("Final acceptance saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Final acceptance could not be saved.");
    } finally {
      setSigning(false);
    }
  }

  function downloadReport() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `damons-archive-final-handoff-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Handoff score" value={`${data.readiness.score}%`} tone={data.readiness.status} />
        <Metric label="Passed" value={String(data.readiness.passed)} tone="ready" />
        <Metric label="Pending" value={String(data.readiness.pending)} tone={data.readiness.pending ? "review" : "ready"} />
        <Metric label="Failed" value={String(data.readiness.failed)} tone={data.readiness.failed ? "blocked" : "ready"} />
        <Metric label="Required" value={`${data.readiness.requiredPassed}/${data.readiness.requiredTotal}`} tone={data.readiness.status} />
      </section>

      <section className="tech-panel rounded-[24px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <ReadinessIcon status={data.readiness.status} />
            <div>
              <h2 className="text-xl font-semibold text-slate-100">
                {data.readiness.status === "ready"
                  ? "Ready for final acceptance"
                  : data.readiness.status === "blocked"
                    ? "Final acceptance is blocked"
                    : "Final acceptance needs review"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Complete every required item, verify the production backup and rollback path, then record the final owner acceptance.
              </p>
            </div>
          </div>
          <button type="button" onClick={downloadReport} className="tech-button-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
            <Download className="size-4" /> Export handoff report
          </button>
        </div>
        {data.readiness.blockers.length ? (
          <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-400/[0.07] p-4 text-sm text-amber-100/85">
            <strong>Remaining blockers:</strong> {data.readiness.blockers.join(" · ")}
          </div>
        ) : null}
        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-cyan-200/80">{message}</p>
      </section>

      {groups.map(({ group, label, items }) => (
        <section key={group} className="tech-panel rounded-[24px] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-200">
              {group === "security" ? <ShieldCheck className="size-5" /> : <FileCheck2 className="size-5" />}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{label}</h2>
              <p className="text-sm text-slate-500">{items.length} final handoff item{items.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {items.map((item) => (
              <article key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <ItemIcon status={item.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-100">{item.label}</h3>
                      <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
                        {item.automatic ? "Automatic" : "Manual"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                    {item.evidence ? <p className="mt-2 rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-xs leading-5 text-slate-500">{item.evidence}</p> : null}
                    {!item.automatic ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(["pending", "pass", "fail"] as HandoffItemStatus[]).map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={savingKey === item.key}
                            onClick={() => updateItem(item, status)}
                            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                              item.status === status
                                ? status === "pass"
                                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                                  : status === "fail"
                                    ? "border-red-300/25 bg-red-400/10 text-red-200"
                                    : "border-amber-300/25 bg-amber-400/10 text-amber-200"
                                : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]"
                            }`}
                          >
                            {savingKey === item.key ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
                            {status === "pass" ? "Passed" : status === "fail" ? "Failed" : "Pending"}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="tech-panel rounded-[24px] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-indigo-400/10 text-indigo-300"><PenLine className="size-5" /></span>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Final owner acceptance</h2>
            <p className="text-sm text-slate-500">Record who accepted the production system and any final operational notes.</p>
          </div>
        </div>
        {data.latestSignoff ? (
          <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.07] p-4 text-sm text-emerald-100/90">
            Accepted by <strong>{data.latestSignoff.acceptedBy}</strong> on {new Date(data.latestSignoff.acceptedAt).toLocaleString()}.
            {data.latestSignoff.notes ? <p className="mt-2 text-emerald-100/70">{data.latestSignoff.notes}</p> : null}
          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <label className="text-sm font-medium text-slate-300">
              Accepted by
              <input value={acceptedBy} onChange={(event) => setAcceptedBy(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-slate-100" placeholder="System owner or authorized representative" />
            </label>
            <label className="text-sm font-medium text-slate-300">
              Final notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-slate-100" placeholder="Optional handoff notes" />
            </label>
            <button type="button" onClick={signOff} disabled={signing || data.readiness.status !== "ready" || !acceptedBy.trim()} className="tech-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold lg:col-span-2">
              {signing ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
              Save final acceptance
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "ready" | "review" | "blocked" }) {
  const toneClass = tone === "ready" ? "text-emerald-300" : tone === "blocked" ? "text-red-300" : "text-amber-300";
  return <article className="tech-panel rounded-[20px] p-4"><span className="text-xs uppercase tracking-[.14em] text-slate-500">{label}</span><strong className={`mt-2 block text-2xl font-semibold ${toneClass}`}>{value}</strong></article>;
}

function ReadinessIcon({ status }: { status: HandoffPageData["readiness"]["status"] }) {
  const cls = status === "ready" ? "bg-emerald-400/10 text-emerald-300" : status === "blocked" ? "bg-red-400/10 text-red-300" : "bg-amber-400/10 text-amber-300";
  return <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${cls}`}>{status === "ready" ? <CheckCircle2 className="size-6" /> : status === "blocked" ? <XCircle className="size-6" /> : <AlertTriangle className="size-6" />}</span>;
}

function ItemIcon({ status }: { status: HandoffItemStatus }) {
  const cls = status === "pass" ? "text-emerald-300" : status === "fail" ? "text-red-300" : "text-amber-300";
  return status === "pass" ? <CheckCircle2 className={`mt-0.5 size-5 shrink-0 ${cls}`} /> : status === "fail" ? <XCircle className={`mt-0.5 size-5 shrink-0 ${cls}`} /> : <RefreshCw className={`mt-0.5 size-5 shrink-0 ${cls}`} />;
}
