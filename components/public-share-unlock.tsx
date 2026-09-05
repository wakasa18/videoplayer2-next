"use client";

import { KeyRound, Link2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function PublicShareUnlock({ token, hint }: { token: string; hint: string | null }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/public-shares/${encodeURIComponent(token)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not unlock this link.");
      // A full navigation guarantees the new HttpOnly unlock cookie is included
      // in the next Server Component request on every supported browser.
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not unlock this link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#030814] p-5">
      <section className="tech-panel relative w-full max-w-md overflow-hidden rounded-[30px] p-7 sm:p-8">
        <div className="tech-scanline" aria-hidden="true" />
        <span className="grid size-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><KeyRound className="size-7" /></span>
        <h1 className="mt-5 text-2xl font-semibold text-slate-100">Protected shared link</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Enter the password supplied by the owner to open this shared content.</p>
        {hint ? <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-3 text-xs text-cyan-200"><strong>Password hint:</strong> {hint}</div> : null}
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Shared-link password" required minLength={6} maxLength={128} className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10" />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Unlock link</button>
        </form>
        <p className="mt-5 flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-slate-500"><Link2 className="size-3.5" /> Damon&apos;s Archive secure sharing</p>
      </section>
    </main>
  );
}
