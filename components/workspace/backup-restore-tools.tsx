"use client";

import { CheckCircle2, FileJson, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

export function BackupRestoreTools() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"validate" | "merge" | null>(null);
  const [message, setMessage] = useState("");

  async function submit(mode: "validate" | "merge") {
    if (!file || busy) return;
    if (mode === "merge" && !window.confirm("Restore metadata from this backup? This safe merge updates matching records only and does not restore Storage bytes or credentials.")) return;
    setBusy(mode); setMessage("");
    try {
      const text = await file.text();
      if (text.length > 15 * 1024 * 1024) throw new Error("Backup JSON is too large for browser restore.");
      const backup = JSON.parse(text) as unknown;
      const response = await fetch("/api/workspace/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup, filename: file.name, mode }) });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "Restore operation failed.");
      setMessage(payload.message || "Backup processed successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Restore operation failed."); }
    finally { setBusy(null); }
  }

  return <section className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-100">Backup restore</h2><p className="mt-1 text-sm leading-6 text-slate-400">Validate a Damon’s Archive JSON backup, then safely merge metadata back into existing records.</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><RotateCcw className="size-5" /></span></div>
    <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[.035] px-4 text-left hover:bg-cyan-300/[.055]"><FileJson className="size-5 text-cyan-300" /><span className="min-w-0"><strong className="block truncate text-sm text-slate-200">{file?.name || "Choose JSON backup"}</strong><small className="text-xs text-slate-500">Metadata restore only — Storage bytes and secrets stay untouched</small></span></button>
    <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setMessage(""); }} />
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><button disabled={!file || busy !== null} onClick={() => void submit("validate")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[.045] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[.07] disabled:opacity-50">{busy === "validate" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Validate backup</button><button disabled={!file || busy !== null} onClick={() => void submit("merge")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{busy === "merge" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore metadata</button></div>
    {message ? <p className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs leading-5 ${message.toLowerCase().includes("success") || message.toLowerCase().includes("valid") || message.toLowerCase().includes("completed") ? "bg-emerald-400/[.08] text-emerald-300" : "bg-amber-400/[.08] text-amber-300"}`}><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{message}</p> : null}
  </section>;
}
