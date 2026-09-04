import {
  Activity,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Film,
  FolderOpen,
  Gauge,
  HardDrive,
  Link2,
  Recycle,
  Settings,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardReveal, DashboardStatCard } from "@/components/dashboard-reveal";
import { getDashboardHomeDataSafe } from "@/lib/workspace/data";
import type {
  DashboardHomeAssignment,
  WorkspaceActivityItem,
  WorkspaceActivityModule,
} from "@/lib/workspace/types";
import {
  formatBytes,
  formatWorkspaceDateTime,
  summarizeActivityDetails,
  workspaceActionLabel,
  workspaceModuleLabel,
} from "@/lib/workspace/utils";

export const dynamic = "force-dynamic";

const PH_TIMEZONE = "Asia/Manila";

export default async function DashboardPage() {
  const data = await getDashboardHomeDataSafe();
  const { summary } = data;
  const now = new Date();
  const greeting = greetingFor(now);
  const firstName = firstDisplayName(data.displayName);
  const todayLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const quotaPercent = data.quotaBytes
    ? Math.min(100, (summary.total_bytes / data.quotaBytes) * 100)
    : 0;
  const contentBytes = summary.file_bytes + summary.video_bytes;
  const filePercent = contentBytes ? (summary.file_bytes / contentBytes) * 100 : 0;
  const videoPercent = contentBytes ? (summary.video_bytes / contentBytes) * 100 : 0;
  const recycleCount = summary.file_recycle_count + summary.video_recycle_count;

  return (
    <main className="space-y-5 sm:space-y-6">
      <DashboardReveal index={0}>
        <section className="tech-panel relative overflow-hidden rounded-[28px] p-5 sm:p-7 lg:p-8">
          <div className="tech-scanline" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-cyan-400/[0.08] blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-24 right-[22%] size-64 rounded-full bg-indigo-500/[0.08] blur-3xl"
            aria-hidden="true"
          />

          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Workspace command center
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                  <span className="tech-status-dot size-1.5 rounded-full bg-emerald-400" />
                  Workspace online
                </span>
              </div>

              <h1 className="tech-title text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-[2.65rem] lg:leading-[1.05]">
                {greeting}, {firstName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Your files, deadlines, videos, shared links, and recent workspace activity are organized here for a faster daily overview.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2">
                  <Clock3 className="size-3.5 text-cyan-300" aria-hidden="true" />
                  {todayLabel} · Philippine time
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2">
                  <ShieldCheck className="size-3.5 text-emerald-300" aria-hidden="true" />
                  Private owner workspace
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <HeroAction
                href="/dashboard/files"
                icon={<FolderOpen className="size-4.5" aria-hidden="true" />}
                title="Open files"
                detail={`${summary.file_count.toLocaleString()} active`}
                primary
              />
              <HeroAction
                href="/dashboard/assignments"
                icon={<ClipboardList className="size-4.5" aria-hidden="true" />}
                title="Assignments"
                detail={`${summary.assignment_count.toLocaleString()} total`}
              />
              <HeroAction
                href="/dashboard/assignments/productivity"
                icon={<BellRing className="size-4.5" aria-hidden="true" />}
                title="Reminder center"
                detail="Schedules & email"
              />
            </div>
          </div>
        </section>
      </DashboardReveal>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          index={0}
          icon="folder-open"
          label="Important files"
          value={summary.file_count.toLocaleString()}
          description="Active private files"
          tint="cyan"
          href="/dashboard/files"
        />
        <DashboardStatCard
          index={1}
          icon="clipboard-check"
          label="Assignments"
          value={summary.assignment_count.toLocaleString()}
          description="Current assignment records"
          tint="indigo"
          href="/dashboard/assignments"
        />
        <DashboardStatCard
          index={2}
          icon="film"
          label="Videos"
          value={summary.video_count.toLocaleString()}
          description="Active private videos"
          tint="pink"
          href="/dashboard/videos"
        />
        <DashboardStatCard
          index={3}
          icon="link"
          label="Active shares"
          value={summary.active_share_count.toLocaleString()}
          description="Public links currently enabled"
          tint="emerald"
          href="/dashboard/files/shares"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <DashboardReveal index={1}>
          <section className="tech-panel overflow-hidden rounded-[26px]">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
                  <CalendarClock className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-100 sm:text-lg">Deadlines & next up</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Date and time follow Philippine time.</p>
                </div>
              </div>
              <Link
                href="/dashboard/assignments?sort=due"
                className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 transition hover:text-cyan-200"
              >
                View all
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            {data.upcomingAssignments.length ? (
              <div className="divide-y divide-white/[0.075]">
                {data.upcomingAssignments.map((assignment) => (
                  <DeadlineRow key={assignment.id} assignment={assignment} now={now} />
                ))}
              </div>
            ) : (
              <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
                <div className="max-w-sm">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-300">
                    <CheckCircle2 className="size-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-100">No scheduled deadlines</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Assignments with a deadline will appear here automatically.
                  </p>
                </div>
              </div>
            )}
          </section>
        </DashboardReveal>

        <DashboardReveal index={2}>
          <section className="tech-panel h-full rounded-[26px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
                  <HardDrive className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-100 sm:text-lg">Storage overview</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Files and video storage</p>
                </div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                {quotaPercent.toFixed(quotaPercent >= 10 ? 0 : 1)}%
              </span>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <strong className="block text-2xl font-semibold tracking-tight text-slate-100">
                    {formatBytes(summary.total_bytes)}
                  </strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    of {formatBytes(data.quotaBytes)} configured quota
                  </span>
                </div>
                <Gauge className="size-6 text-slate-600" aria-hidden="true" />
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full border border-white/[0.06] bg-black/20">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#6366f1)] shadow-[0_0_18px_rgba(34,211,238,.2)]"
                  style={{ width: `${Math.max(quotaPercent > 0 ? 1.5 : 0, quotaPercent)}%` }}
                />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <StorageLine
                icon={<FileText className="size-4" aria-hidden="true" />}
                label="Files"
                value={formatBytes(summary.file_bytes)}
                percent={filePercent}
                barClass="bg-cyan-400"
                iconClass="bg-cyan-400/10 text-cyan-300"
              />
              <StorageLine
                icon={<Video className="size-4" aria-hidden="true" />}
                label="Videos"
                value={formatBytes(summary.video_bytes)}
                percent={videoPercent}
                barClass="bg-violet-400"
                iconClass="bg-violet-400/10 text-violet-300"
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <MiniMetric
                icon={<Recycle className="size-4 text-amber-300" aria-hidden="true" />}
                label="Recycle bin"
                value={recycleCount.toLocaleString()}
              />
              <MiniMetric
                icon={<Link2 className="size-4 text-emerald-300" aria-hidden="true" />}
                label="Active shares"
                value={summary.active_share_count.toLocaleString()}
              />
            </div>

            <Link
              href="/dashboard/settings"
              className="tech-interactive mt-5 flex min-h-11 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.065] hover:text-cyan-100"
            >
              Manage storage settings
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        </DashboardReveal>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <DashboardReveal index={3}>
          <section className="tech-panel overflow-hidden rounded-[26px]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-300">
                  <Activity className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-100">Recent activity</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Latest workspace events</p>
                </div>
              </div>
              <Link href="/dashboard/activity" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                Full history
              </Link>
            </div>

            {data.recentActivity.length ? (
              <div className="divide-y divide-white/[0.075]">
                {data.recentActivity.map((item) => (
                  <ActivityPreview key={item.activity_key} item={item} timezone={data.timezone} />
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                Activity will appear after you manage files, assignments, videos, or account settings.
              </div>
            )}
          </section>
        </DashboardReveal>

        <DashboardReveal index={4}>
          <section className="tech-panel rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-indigo-300/15 bg-indigo-400/10 text-indigo-300">
                <Zap className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-100">Quick access</h2>
                <p className="mt-0.5 text-xs text-slate-500">Jump straight to common workspace tasks</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <QuickAccess
                href="/dashboard/files"
                icon={<FolderOpen className="size-5" aria-hidden="true" />}
                title="Important Files"
                detail="Upload, organize, preview"
                className="text-cyan-300 bg-cyan-400/10 border-cyan-300/15"
              />
              <QuickAccess
                href="/dashboard/assignments"
                icon={<ClipboardList className="size-5" aria-hidden="true" />}
                title="Assignments"
                detail="Deadlines and progress"
                className="text-indigo-300 bg-indigo-400/10 border-indigo-300/15"
              />
              <QuickAccess
                href="/dashboard/videos"
                icon={<Film className="size-5" aria-hidden="true" />}
                title="Video Library"
                detail="Private media archive"
                className="text-pink-300 bg-pink-400/10 border-pink-300/15"
              />
              <QuickAccess
                href="/dashboard/files/shares"
                icon={<Link2 className="size-5" aria-hidden="true" />}
                title="Shared Links"
                detail="Review public access"
                className="text-emerald-300 bg-emerald-400/10 border-emerald-300/15"
              />
              <QuickAccess
                href="/dashboard/assignments/productivity"
                icon={<BellRing className="size-5" aria-hidden="true" />}
                title="Productivity"
                detail="Reminders and email"
                className="text-amber-300 bg-amber-400/10 border-amber-300/15"
              />
              <QuickAccess
                href="/dashboard/settings"
                icon={<Settings className="size-5" aria-hidden="true" />}
                title="Settings"
                detail="Profile, security, backup"
                className="text-slate-300 bg-white/[0.045] border-white/10"
              />
            </div>
          </section>
        </DashboardReveal>
      </section>
    </main>
  );
}

function HeroAction({
  href,
  icon,
  title,
  detail,
  primary = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`tech-interactive group flex min-h-[58px] items-center gap-3 rounded-2xl border px-3.5 py-2.5 ${
        primary
          ? "border-cyan-300/25 bg-[linear-gradient(135deg,rgba(34,211,238,.14),rgba(79,70,229,.11))]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
          primary ? "bg-cyan-400/10 text-cyan-200" : "bg-white/[0.045] text-slate-300"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-slate-100">{title}</strong>
        <small className="mt-0.5 block truncate text-[11px] text-slate-500">{detail}</small>
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
    </Link>
  );
}

function DeadlineRow({ assignment, now }: { assignment: DashboardHomeAssignment; now: Date }) {
  const deadline = assignmentDeadlineInfo(assignment, now);
  return (
    <Link
      href={`/dashboard/assignments/${assignment.id}`}
      className="group flex items-center gap-3.5 px-5 py-4 transition hover:bg-white/[0.035] sm:px-6"
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl border ${
          deadline.overdue
            ? "border-rose-300/20 bg-rose-400/10 text-rose-300"
            : deadline.isToday
              ? "border-amber-300/20 bg-amber-400/10 text-amber-300"
              : "border-cyan-300/15 bg-cyan-400/10 text-cyan-300"
        }`}
      >
        <CalendarClock className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <strong className="truncate text-sm font-semibold text-slate-100 group-hover:text-cyan-100">
            {assignment.title}
          </strong>
          {assignment.priority === "high" ? (
            <span className="shrink-0 rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
              High
            </span>
          ) : null}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {assignment.subject ? <span className="truncate">{assignment.subject}</span> : null}
          {assignment.subject ? <span className="text-slate-700">•</span> : null}
          <span className={deadline.overdue ? "font-semibold text-rose-300" : deadline.isToday ? "font-semibold text-amber-300" : "text-slate-400"}>
            {deadline.label}
          </span>
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
    </Link>
  );
}

function StorageLine({
  icon,
  label,
  value,
  percent,
  barClass,
  iconClass,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  percent: number;
  barClass: string;
  iconClass: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={`grid size-8 place-items-center rounded-lg ${iconClass}`}>{icon}</span>
        <span className="min-w-0 flex-1 text-xs font-medium text-slate-400">{label}</span>
        <strong className="text-xs font-semibold text-slate-200">{value}</strong>
      </div>
      <div className="ml-11 mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.045]">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(percent > 0 ? 1 : 0, percent)}%` }} />
      </div>
    </div>
  );
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="flex items-center gap-2">{icon}<span className="text-[11px] text-slate-500">{label}</span></div>
      <strong className="mt-2 block text-lg font-semibold text-slate-100">{value}</strong>
    </div>
  );
}

function ActivityPreview({
  item,
  timezone,
}: {
  item: WorkspaceActivityItem;
  timezone: string;
}) {
  const href = activityHref(item);
  const content = (
    <>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${activityModuleClass(item.module)}`}>
        {activityModuleIcon(item.module)}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-slate-200">{workspaceActionLabel(item.action)}</strong>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{summarizeActivityDetails(item.details)}</span>
      </span>
      <time dateTime={item.created_at} className="hidden shrink-0 text-[11px] text-slate-600 sm:block">
        {formatWorkspaceDateTime(item.created_at, timezone)}
      </time>
    </>
  );

  return href ? (
    <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.035] sm:px-6">
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-5 py-3.5 sm:px-6">{content}</div>
  );
}

function QuickAccess({
  href,
  icon,
  title,
  detail,
  className,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  className: string;
}) {
  return (
    <Link href={href} className="tech-interactive group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3.5 hover:bg-white/[0.05]">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${className}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-slate-200">{title}</strong>
        <small className="mt-0.5 block truncate text-[11px] text-slate-500">{detail}</small>
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
    </Link>
  );
}

function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PH_TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstDisplayName(value: string): string {
  const first = value.trim().split(/\s+/)[0] || "there";
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

function assignmentDeadlineInfo(assignment: DashboardHomeAssignment, now: Date) {
  const currentDate = dateKeyFor(now, PH_TIMEZONE);
  const tomorrow = addDateDays(currentDate, 1);
  const time = assignment.due_time?.slice(0, 5) ?? null;
  const deadline = new Date(`${assignment.due_date}T${time ?? "23:59"}:00+08:00`);
  const overdue = deadline.getTime() < now.getTime();
  const isToday = assignment.due_date === currentDate;
  const isTomorrow = assignment.due_date === tomorrow;
  const timeLabel = time ? formatClockTime(time) : "end of day";

  let dateLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${assignment.due_date}T12:00:00+08:00`));
  if (isToday) dateLabel = overdue ? "Overdue today" : "Today";
  else if (isTomorrow) dateLabel = "Tomorrow";
  else if (overdue) dateLabel = `Overdue · ${dateLabel}`;

  return {
    overdue,
    isToday,
    label: `${dateLabel}, ${timeLabel}`,
  };
}

function dateKeyFor(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addDateDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function formatClockTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}

function activityHref(item: WorkspaceActivityItem): string | null {
  if (!item.target_id) return null;
  if (item.module === "files") return `/dashboard/files/${item.target_id}`;
  if (item.module === "assignments") return `/dashboard/assignments/${item.target_id}`;
  if (item.module === "videos") return `/dashboard/videos/${item.target_id}`;
  return null;
}

function activityModuleClass(module: WorkspaceActivityModule): string {
  if (module === "files") return "bg-cyan-400/10 text-cyan-300";
  if (module === "assignments") return "bg-amber-400/10 text-amber-300";
  if (module === "videos") return "bg-violet-400/10 text-violet-300";
  return "bg-emerald-400/10 text-emerald-300";
}

function activityModuleIcon(module: WorkspaceActivityModule) {
  if (module === "files") return <FileText className="size-4" aria-label={workspaceModuleLabel(module)} />;
  if (module === "assignments") return <ClipboardList className="size-4" aria-label={workspaceModuleLabel(module)} />;
  if (module === "videos") return <Film className="size-4" aria-label={workspaceModuleLabel(module)} />;
  return <ShieldCheck className="size-4" aria-label={workspaceModuleLabel(module)} />;
}
