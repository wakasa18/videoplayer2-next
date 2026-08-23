import { AlertTriangle, ShieldCheck, Wrench } from "lucide-react";

import { MaintenanceClient } from "@/components/maintenance/maintenance-client";
import { getMaintenanceDashboardData } from "@/lib/maintenance/data";

export const metadata = { title: "Maintenance" };
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  try {
    const data = await getMaintenanceDashboardData();
    return (
      <main className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#1967d2]">
                <Wrench className="size-4" aria-hidden="true" />
                Phase 10 post-launch operations
              </div>
              <h1 className="text-3xl font-semibold tracking-[-.03em] text-[#202124] sm:text-4xl">Maintenance and monitoring</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5f6368] sm:text-base">
                Monitor storage usage, stale uploads, missing objects, recent errors, database response time, daily automation, and metadata-backup health from one owner-only page.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e6f4ea] px-4 py-2 text-sm font-semibold text-[#137333]">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Production operations
            </div>
          </div>
        </section>
        <MaintenanceClient data={data} />
      </main>
    );
  } catch (error) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="w-full max-w-2xl rounded-[28px] border border-[#f2d6a1] bg-white p-8 shadow-sm">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#fef7e0] text-[#b06000]"><AlertTriangle className="size-7" /></span>
          <h1 className="mt-5 text-2xl font-semibold text-[#202124]">Maintenance needs Phase 10 setup</h1>
          <p className="mt-3 text-sm leading-6 text-[#5f6368]">{error instanceof Error ? error.message : "Maintenance data could not be loaded."}</p>
          <div className="mt-5 rounded-2xl bg-[#f8f9fa] p-4 text-sm leading-6 text-[#3c4043]">Run database/phase10_post_launch_maintenance.sql in Supabase, then refresh this page.</div>
        </section>
      </main>
    );
  }
}
