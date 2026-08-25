import { AlertTriangle, BadgeCheck } from "lucide-react";

import { DashboardReveal } from "@/components/dashboard-reveal";
import { HandoffClient } from "@/components/handoff/handoff-client";
import { getHandoffPageData } from "@/lib/handoff/data";

export const metadata = { title: "Final Handoff" };
export const dynamic = "force-dynamic";

export default async function HandoffPage() {
  try {
    const data = await getHandoffPageData();
    return (
      <main className="space-y-5">
        <DashboardReveal index={0}>
          <section className="tech-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
            <div className="tech-scanline" aria-hidden="true" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                  <BadgeCheck className="size-4" /> Phase 12 · Final acceptance and operational handoff
                </div>
                <h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">Final handoff center</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">Complete user acceptance, confirm backup and rollback readiness, review security ownership, and save the final production sign-off.</p>
              </div>
              <div className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">Operational acceptance workspace</div>
            </div>
          </section>
        </DashboardReveal>
        <HandoffClient initialData={data} />
      </main>
    );
  } catch (error) {
    return <main className="grid min-h-[68vh] place-items-center"><section className="tech-panel w-full max-w-2xl rounded-[28px] p-8"><AlertTriangle className="size-8 text-amber-300" /><h1 className="mt-5 text-2xl font-semibold text-slate-100">Phase 12 database setup is required</h1><p className="mt-3 text-sm leading-6 text-slate-400">{error instanceof Error ? error.message : "Final handoff data could not be loaded."}</p><div className="mt-5 rounded-2xl bg-white/[0.035] p-4 text-sm text-slate-200">Run <code>database/phase12_acceptance_handoff.sql</code> in Supabase, then refresh.</div></section></main>;
  }
}
