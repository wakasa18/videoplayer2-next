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
import { DashboardReveal, DashboardStatCard, DashboardQuickLink } from "@/components/dashboard-reveal";
import { getWorkspaceSummarySafe } from "@/lib/workspace/data";
import { formatBytes } from "@/lib/workspace/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getWorkspaceSummarySafe();

  return (
    <main className="space-y-6">
      <DashboardReveal index={0}>
        <section className="tech-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
          <div className="tech-scanline" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                <Cloud className="size-4" aria-hidden="true" />
                Private cloud workspace
              </div>
              <h1 className="tech-title text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Damon&apos;s Archive
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
                Files, assignments, reminders, shared links, videos, activity history, and account settings are now available in the migrated Next.js workspace.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">
              <span className="tech-status-dot size-2 rounded-full bg-emerald-400" />
              Phase 7 finalization
            </div>
          </div>
        </section>
      </DashboardReveal>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardStatCard
          index={0}
          icon={FolderOpen}
          label="Important files"
          value={summary.file_count.toLocaleString()}
          description="Active private files"
          tint="cyan"
        />
        <DashboardStatCard
          index={1}
          icon={ClipboardCheck}
          label="Assignments"
          value={summary.assignment_count.toLocaleString()}
          description="Active and completed work"
          tint="indigo"
        />
        <DashboardStatCard
          index={2}
          icon={Film}
          label="Videos"
          value={summary.video_count.toLocaleString()}
          description="Active private videos"
          tint="pink"
        />
        <DashboardStatCard
          index={3}
          icon={HardDrive}
          label="Storage used"
          value={formatBytes(summary.total_bytes)}
          description="Files and videos, including recycle bins"
          tint="amber"
        />
        <DashboardStatCard
          index={4}
          icon={ShieldCheck}
          label="Migration"
          value="Phase 7"
          description="Finalization and hardening"
          tint="emerald"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DashboardQuickLink
          index={0}
          href="/dashboard/activity"
          icon={Activity}
          tint="cyan"
          title="Review workspace activity"
          description="Search owner-safe file, assignment, video, and account events from one timeline."
        />
        <DashboardQuickLink
          index={1}
          href="/dashboard/settings"
          icon={Settings}
          tint="emerald"
          title="Manage settings and backup"
          description="Update your profile, monitor storage, change your password, and export private metadata."
        />
      </section>
    </main>
  );
}
