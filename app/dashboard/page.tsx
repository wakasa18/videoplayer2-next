import {
  Activity,
  ClipboardCheck,
  Cloud,
  Film,
  FolderOpen,
  HardDrive,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { getWorkspaceSummarySafe } from "@/lib/workspace/data";
import { formatBytes } from "@/lib/workspace/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getWorkspaceSummarySafe();

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
              Damon&apos;s Archive
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#5f6368] sm:text-base">
              Files, assignments, reminders, shared links, videos, activity history, and account settings are now available in the migrated Next.js workspace.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e6f4ea] px-4 py-2 text-sm font-semibold text-[#137333]">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Phase 7 finalization
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardStat
          icon={FolderOpen}
          label="Important files"
          value={summary.file_count.toLocaleString()}
          description="Active private files"
        />
        <DashboardStat
          icon={ClipboardCheck}
          label="Assignments"
          value={summary.assignment_count.toLocaleString()}
          description="Active and completed work"
        />
        <DashboardStat
          icon={Film}
          label="Videos"
          value={summary.video_count.toLocaleString()}
          description="Active private videos"
        />
        <DashboardStat
          icon={HardDrive}
          label="Storage used"
          value={formatBytes(summary.total_bytes)}
          description="Files and videos, including recycle bins"
        />
        <DashboardStat
          icon={ShieldCheck}
          label="Migration"
          value="Phase 7"
          description="Finalization and hardening"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/dashboard/activity"
          className="group rounded-[24px] border border-[#e1e5ea] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c6dafc] hover:shadow-md"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2]">
            <Activity className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-[#202124]">
            Review workspace activity
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6368]">
            Search owner-safe file, assignment, video, and account events from one timeline.
          </p>
        </Link>

        <Link
          href="/dashboard/settings"
          className="group rounded-[24px] border border-[#e1e5ea] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c6dafc] hover:shadow-md"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-[#e6f4ea] text-[#137333]">
            <Settings className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-[#202124]">
            Manage settings and backup
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6368]">
            Update your profile, monitor storage, change your password, and export private metadata.
          </p>
        </Link>
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
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#5f6368]">{label}</p>
          <strong className="mt-2 block truncate text-2xl font-semibold tracking-tight text-[#202124]">
            {value}
          </strong>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1967d2] transition-transform duration-200 group-hover:scale-105">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#80868b]">{description}</p>
    </article>
  );
}
