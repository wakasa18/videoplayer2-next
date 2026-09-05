"use client";

import { Clock3, Laptop2, Loader2, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { LoginHistoryItem, SecuritySession } from "@/lib/security/data";

export function SecurityCenterClient({
  sessions,
  history,
}: {
  sessions: SecuritySession[];
  history: LoginHistoryItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  async function revoke(id: string, current: boolean) {
    if (!window.confirm(current ? "Sign out this current session?" : "Revoke this session?")) return;
    setBusy(id);
    try {
      const response = await fetch(`/api/security/sessions/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; current?: boolean };
      if (!response.ok) throw new Error(payload.error ?? "Session could not be revoked.");
      if (payload.current) {
        router.replace("/auth/login");
        router.refresh();
        return;
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Session could not be revoked.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)]">
      <section className="tech-panel rounded-[26px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Active sessions</h2>
            <p className="mt-1 text-sm text-slate-400">Devices tracked after the Phase 13 secure login flow.</p>
          </div>
          <span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Laptop2 className="size-5" /></span>
        </div>
        <div className="mt-5 space-y-3">
          {sessions.length ? sessions.map((item) => {
            const inactive = Boolean(item.revoked_at);
            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${inactive ? "bg-red-400/10 text-red-300" : "bg-emerald-400/10 text-emerald-300"}`}>
                  {inactive ? <ShieldAlert className="size-5" /> : <ShieldCheck className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-slate-100">{item.device_label || "Browser session"}</strong>
                    {item.current ? <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Current</span> : null}
                    {inactive ? <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">Revoked</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Last active {formatDate(item.last_seen_at)} · Started {formatDate(item.created_at)}</p>
                </div>
                {!inactive ? (
                  <button onClick={() => void revoke(item.id, item.current)} disabled={busy === item.id} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-300/20 bg-red-400/[0.06] px-4 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50">
                    {busy === item.id ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                    {item.current ? "Sign out" : "Revoke"}
                  </button>
                ) : null}
              </div>
            );
          }) : <p className="rounded-2xl bg-white/[0.035] p-4 text-sm text-slate-400">No tracked sessions yet. Sign out and sign back in once after running Phase 13.</p>}
        </div>
      </section>

      <section className="tech-panel rounded-[26px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Login history</h2>
            <p className="mt-1 text-sm text-slate-400">Successful, failed, locked, and revoked access events.</p>
          </div>
          <span className="grid size-11 place-items-center rounded-2xl bg-violet-400/10 text-violet-300"><Clock3 className="size-5" /></span>
        </div>
        <div className="mt-5 max-h-[620px] space-y-2 overflow-y-auto pr-1">
          {history.length ? history.map((item) => <HistoryRow key={item.id} item={item} />) : <p className="rounded-2xl bg-white/[0.035] p-4 text-sm text-slate-400">No login history is available yet.</p>}
        </div>
      </section>
    </div>
  );
}

function HistoryRow({ item }: { item: LoginHistoryItem }) {
  const success = item.status === "success";
  const bad = item.status === "failed" || item.status === "locked";
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <strong className={`text-xs font-semibold uppercase tracking-wider ${success ? "text-emerald-300" : bad ? "text-red-300" : "text-cyan-300"}`}>{item.status.replaceAll("_", " ")}</strong>
        <span className="text-[11px] text-slate-500">{formatDate(item.created_at)}</span>
      </div>
      <p className="mt-1 text-sm text-slate-300">{item.device_label || "Security event"}</p>
      {item.reason ? <p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p> : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}
