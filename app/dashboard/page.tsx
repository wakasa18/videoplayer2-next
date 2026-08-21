import { ClipboardCheck, Cloud, FolderOpen, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [filesResult, assignmentsResult] = await Promise.all([
    supabase
      .from("important_files")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true }),
  ]);

  const connectionReady = !filesResult.error && !assignmentsResult.error;

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-[#e1e5ea] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#1967d2]">
              <Cloud className="size-4" aria-hidden="true" />
              Private cloud workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#202124] sm:text-4xl">
              Welcome to your new dashboard
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#5f6368] sm:text-base">
              Your Next.js application is connected to Supabase. Complete the
              migration one module at a time while the current system remains
              online.
            </p>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              connectionReady
                ? "bg-[#e6f4ea] text-[#137333]"
                : "bg-[#fef7e0] text-[#a15c00]"
            }`}
          >
            {connectionReady ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <Cloud className="size-4" aria-hidden="true" />
            )}
            {connectionReady ? "Supabase connected" : "Check RLS permissions"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStat
          icon={FolderOpen}
          label="Important files"
          value={filesResult.error ? "—" : String(filesResult.count ?? 0)}
          description={
            filesResult.error
              ? "Hidden until table access is configured"
              : "Active files in Supabase"
          }
        />
        <DashboardStat
          icon={ClipboardCheck}
          label="Assignments"
          value={
            assignmentsResult.error ? "—" : String(assignmentsResult.count ?? 0)
          }
          description={
            assignmentsResult.error
              ? "Hidden until table access is configured"
              : "Assignments found in Supabase"
          }
        />
        <DashboardStat
          icon={ShieldCheck}
          label="Migration status"
          value="Phase 1"
          description="Authentication and dashboard setup"
        />
      </section>

      <section className="rounded-[24px] border border-[#e1e5ea] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-[#202124]">
          Next migration step
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5f6368]">
          After login, logout, protected routes, and session refresh are tested,
          begin the read-only Important Files module. Do not enable uploads or
          deletion yet.
        </p>
      </section>
    </main>
  );
}

type DashboardStatProps = {
  icon: typeof FolderOpen;
  label: string;
  value: string;
  description: string;
};

function DashboardStat({
  icon: Icon,
  label,
  value,
  description,
}: DashboardStatProps) {
  return (
    <article className="group rounded-[24px] border border-[#e1e5ea] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#c6dafc] hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#5f6368]">{label}</p>
          <strong className="mt-2 block text-3xl font-semibold tracking-tight text-[#202124]">
            {value}
          </strong>
        </div>
        <span className="grid size-11 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2] transition-transform duration-200 group-hover:scale-105">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#80868b]">{description}</p>
    </article>
  );
}
