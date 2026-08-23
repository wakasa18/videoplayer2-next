import { AlertTriangle, BellRing } from "lucide-react";

import { AssignmentProductivityCenter } from "@/components/assignments/assignment-productivity-center";
import { getAssignmentProductivityData } from "@/lib/assignments/productivity";
import { getAssignmentSubjects } from "@/lib/assignments/data";

export const metadata = { title: "Assignment Productivity" };
export const dynamic = "force-dynamic";

export default async function AssignmentProductivityPage() {
  const result = await loadPageData();
  if (result.ok) {
    return <AssignmentProductivityCenter data={result.data} subjects={result.subjects} />;
  }

  return (
    <main className="grid min-h-[68vh] place-items-center">
      <section className="w-full max-w-2xl rounded-[28px] border border-amber-300/25 bg-white/[0.045] p-7 shadow-sm sm:p-9">
        <span className="grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
          <AlertTriangle className="size-7" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.08em] text-slate-400">Phase 5C</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Productivity tools need the Phase 5C database update</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{result.message}</p>
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/[0.035] p-4 text-sm leading-6 text-slate-200">
          <BellRing className="mt-0.5 size-5 shrink-0 text-cyan-300" />
          <p>Run <code>database/phase5c_assignment_automation.sql</code> in Supabase, configure <code>CRON_SECRET</code>, then restart the Next.js app.</p>
        </div>
      </section>
    </main>
  );
}

async function loadPageData() {
  try {
    const [data, subjects] = await Promise.all([
      getAssignmentProductivityData(),
      getAssignmentSubjects(),
    ]);
    return { ok: true as const, data, subjects };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
