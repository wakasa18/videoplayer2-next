import { AlertTriangle, ShieldCheck } from "lucide-react";

import { DashboardReveal } from "@/components/dashboard-reveal";
import { SecurityCenterClient } from "@/components/security/security-center-client";
import { getSecurityCenterData } from "@/lib/security/data";

export const metadata = { title: "Security Center" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  try {
    const data = await getSecurityCenterData();
    return (
      <main className="space-y-5">
        <DashboardReveal index={0}>
          <section className="tech-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
            <div className="tech-scanline" aria-hidden="true" />
            <div className="flex items-end justify-between gap-6">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><ShieldCheck className="size-4" /> Protected access</div>
                <h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">Security center</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Review active sessions, login history, revocations, and brute-force lockouts from one owner-only page.</p>
              </div>
            </div>
          </section>
        </DashboardReveal>
        <SecurityCenterClient sessions={data.sessions} history={data.history} />
      </main>
    );
  } catch (error) {
    return <main className="grid min-h-[65vh] place-items-center"><section className="tech-panel w-full max-w-2xl rounded-[28px] p-7"><AlertTriangle className="size-8 text-amber-300" /><h1 className="mt-4 text-2xl font-semibold text-slate-100">Security Center needs Phase 13</h1><p className="mt-3 text-sm leading-6 text-slate-400">{error instanceof Error ? error.message : "Security data could not be loaded."}</p></section></main>;
  }
}
