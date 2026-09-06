import { AlertTriangle, BadgeCheck, FlaskConical } from "lucide-react";

import { DashboardReveal } from "@/components/dashboard-reveal";
import { QualityAssuranceClient } from "@/components/quality/quality-assurance-client";
import { getQualityPageData } from "@/lib/quality/data";

export const metadata = { title: "Quality Assurance" };
export const dynamic = "force-dynamic";

export default async function QualityPage() {
  try {
    const data = await getQualityPageData();
    return (
      <main className="space-y-5">
        <DashboardReveal index={0}>
          <section className="tech-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
            <div className="tech-scanline" aria-hidden="true" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                  <FlaskConical className="size-4" aria-hidden="true" />
                  Phase 11 · Final QA and production hardening
                </div>
                <h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">
                  Quality assurance center
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                  Run owner-safe checks for security, schema readiness, Storage integrity, scheduled automation, runtime stability, real-user performance, and accessibility foundations.
                </p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                <BadgeCheck className="size-4" aria-hidden="true" />
                Release sign-off workspace
              </div>
            </div>
          </section>
        </DashboardReveal>

        <QualityAssuranceClient initialData={data} />
      </main>
    );
  } catch (error) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="tech-panel w-full max-w-2xl rounded-[22px] p-5 sm:rounded-[28px] sm:p-8">
          <span className="grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-slate-100">Phase 11 database setup is required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {error instanceof Error ? error.message : "Quality assurance data could not be loaded."}
          </p>
          <div className="mt-5 rounded-2xl bg-white/[0.035] p-4 text-sm leading-6 text-slate-200">
            Run <code>database/phase11_quality_assurance.sql</code> in Supabase, then refresh this page.
          </div>
        </section>
      </main>
    );
  }
}
