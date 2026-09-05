"use client";

import { CheckCircle2, Fingerprint, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

export function FileIntegrityCard({ fileId, checksum, verifiedAt }: { fileId: number; checksum: string | null; verifiedAt: string | null }) {
  const [state, setState] = useState({ checksum, verifiedAt, match: true, initialized: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/files/${fileId}/integrity`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; checksum?: string; baseline?: string; match?: boolean; initialized?: boolean; verifiedAt?: string };
      if (!response.ok) throw new Error(payload.error ?? "Integrity check failed.");
      setState({ checksum: payload.baseline || payload.checksum || null, verifiedAt: payload.verifiedAt || new Date().toISOString(), match: payload.match !== false, initialized: Boolean(payload.initialized) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Integrity check failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${state.match ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{state.match ? <Fingerprint className="size-5" /> : <ShieldAlert className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <strong className="text-sm text-slate-100">File integrity</strong>
          <p className="mt-1 text-xs leading-5 text-slate-400">{state.checksum ? `${state.checksum.slice(0, 16)}…${state.checksum.slice(-8)}` : "No baseline hash yet."}</p>
          {state.verifiedAt ? <p className="mt-1 text-[11px] text-slate-500">Verified {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(state.verifiedAt))}</p> : null}
          {state.initialized ? <p className="mt-1 text-[11px] text-cyan-300">Baseline initialized from the stored object.</p> : null}
          {!state.match ? <p className="mt-1 text-xs font-semibold text-red-300">Checksum mismatch detected.</p> : null}
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
        </div>
      </div>
      <button onClick={() => void verify()} disabled={busy} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 text-emerald-300" />} Verify SHA-256</button>
    </div>
  );
}
