import { AlertTriangle, ClipboardList } from "lucide-react";

import { AssignmentBrowser } from "@/components/assignments/assignment-browser";
import { getAssignmentsBrowser } from "@/lib/assignments/data";
import { parseAssignmentFilters } from "@/lib/assignments/utils";

type AssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const filters = parseAssignmentFilters(await searchParams);

  let result: Awaited<ReturnType<typeof getAssignmentsBrowser>> | null = null;
  let message = "";

  try {
    result = await getAssignmentsBrowser(filters);
  } catch (error) {
    message = error instanceof Error ? error.message : "Unknown error";
  }

  if (!result) {
    return (
      <main className="grid min-h-[68vh] place-items-center">
        <section className="w-full max-w-2xl rounded-[28px] border border-amber-300/25 bg-white/[0.045] p-5 shadow-sm sm:p-9">
          <span className="grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.08em] text-slate-400">
            Phase 5B
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">
            Assignments needs server access
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/[0.035] p-4 text-sm leading-6 text-slate-200">
            <ClipboardList className="mt-0.5 size-5 shrink-0 text-cyan-300" aria-hidden="true" />
            <p>
              Confirm <code>SUPABASE_SERVICE_ROLE_KEY</code> is configured. Run <code>assignments_complete_upgrade.sql</code> first, then <code>phase5b_assignment_management.sql</code> to enable owner-secured assignment management.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return <AssignmentBrowser result={result} />;
}
