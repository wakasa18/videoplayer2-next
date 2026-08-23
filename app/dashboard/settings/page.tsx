import { DashboardReveal } from "@/components/dashboard-reveal";
import { AlertTriangle, Settings, ShieldCheck } from "lucide-react";

import { WorkspaceSettingsClient } from "@/components/workspace/settings-client";
import { getWorkspaceSettingsData } from "@/lib/workspace/data";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const data = await getWorkspaceSettingsData();

    return (
      <main className="space-y-5">
        <DashboardReveal index={0}>
        <section className="tech-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
          <div className="tech-scanline" aria-hidden="true" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                <Settings className="size-4" aria-hidden="true" />
                Phase 7 workspace controls
              </div>
              <h1 className="text-3xl font-semibold tracking-[-.03em] text-slate-100 sm:text-4xl">
                Settings and security
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Manage your profile, timezone, storage visibility, password, and private metadata backup from one owner-safe page.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Owner-scoped settings
            </div>
          </div>
        </section>
      </DashboardReveal>


        <WorkspaceSettingsClient data={data} />
      </main>
    );
  } catch (error) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="w-full max-w-2xl rounded-[28px] border border-amber-300/25 bg-[#0b1220]/90 p-8 shadow-[0_18px_50px_rgba(0,4,14,0.5)] backdrop-blur-xl">
          <span className="grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-slate-100">
            Phase 7 needs database setup
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {error instanceof Error ? error.message : "Settings could not be loaded."}
          </p>
          <div className="mt-5 rounded-2xl bg-white/[0.035] p-4 text-sm leading-6 text-slate-200">
            Run <code>database/phase7_workspace_finalization.sql</code> in the Supabase SQL Editor, then refresh this page.
          </div>
        </section>
      </main>
    );
  }
}
