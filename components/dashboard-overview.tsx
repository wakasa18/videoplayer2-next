import {
  Activity, ArrowRight, ArrowUpRight, BellRing, CalendarDays, Check,
  CheckCircle2, ClipboardList, Clock3, FileText, Film, FolderOpen,
  HardDrive, Recycle, ShieldCheck, Upload, Wrench,
} from "@/components/ui/icons";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { DashboardReveal, DashboardStatCard } from "@/components/dashboard-reveal";
import type { DashboardHomeAssignment, DashboardHomeData, WorkspaceActivityItem } from "@/lib/workspace/types";
import { formatBytes, formatWorkspaceDateTime, summarizeActivityDetails, workspaceActionLabel } from "@/lib/workspace/utils";

const DEADLINE_TIMEZONE = "Asia/Manila";

export function DashboardOverview({ data, now = new Date() }: { data: DashboardHomeData; now?: Date }) {
  const { summary } = data;
  const timezone = data.timezone || DEADLINE_TIMEZONE;
  const todayLabel = new Intl.DateTimeFormat("en", { timeZone: timezone, weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(now);
  const quotaPercent = data.quotaBytes > 0 ? Math.min(100, Math.max(0, (summary.total_bytes / data.quotaBytes) * 100)) : 0;
  const filePercent = data.quotaBytes > 0 ? Math.min(quotaPercent, Math.max(0, (summary.file_bytes / data.quotaBytes) * 100)) : 0;
  const urgentAssignments = data.upcomingAssignments.filter((item) => {
    const deadline = assignmentDeadlineInfo(item, now);
    return deadline.overdue || deadline.isToday;
  }).length;

  return (
    <div className="archive-overview">
      <DashboardReveal>
        <div className="archive-page-context">
          <p>Workspace <span aria-hidden="true">/</span> <span>Overview</span></p>
          <time dateTime={now.toISOString()}><CalendarDays size={14} aria-hidden="true" />{todayLabel}</time>
        </div>
        <section className="archive-welcome" aria-labelledby="welcome-title">
          <div><h1 id="welcome-title">{greetingFor(now, timezone)}, {firstDisplayName(data.displayName)}<span className="archive-heading-dot">.</span></h1><p>Your files, ideas, and deadlines, together in one place.</p></div>
          <div className="archive-welcome-actions">
            <Link data-no-glass className="archive-button archive-button-primary" href="/dashboard/files?command=upload"><Upload size={16} aria-hidden="true" />Upload files</Link>
          </div>
        </section>
      </DashboardReveal>

      <section aria-labelledby="library-title">
        <div className="archive-section-heading"><h2 id="library-title">Your library</h2><span>Everything in its place</span></div>
        <div className="archive-library-grid">
          <DashboardStatCard index={0} icon="folder-open" label="Important files" value={summary.file_count.toLocaleString()} description="Documents & essentials" tint="cyan" href="/dashboard/files" />
          <DashboardStatCard index={1} icon="clipboard-check" label="Assignments" value={summary.assignment_count.toLocaleString()} description="Projects & coursework" tint="indigo" href="/dashboard/assignments" />
          <DashboardStatCard index={2} icon="film" label="Videos" value={summary.video_count.toLocaleString()} description="Your private collection" tint="pink" href="/dashboard/videos" />
          <DashboardStatCard index={3} icon="link" label="Shared links" value={summary.active_share_count.toLocaleString()} description="Links with active access" tint="emerald" href="/dashboard/files/shares" />
        </div>
      </section>

      <div className="archive-overview-columns">
        <div className="archive-main-column">
          <DashboardReveal index={1}>
            <section className="archive-panel" aria-labelledby="deadlines-title">
              <PanelHeading id="deadlines-title" title="On your horizon" subtitle="Upcoming assignments, ordered by due date" href="/dashboard/assignments?sort=due" linkLabel="All assignments" icon={<CalendarDays size={18} />} />
              <div className="archive-deadline-summary"><span><span className={`archive-status-dot ${urgentAssignments ? "archive-status-amber" : "archive-status-green"}`} />{urgentAssignments ? `${urgentAssignments} ${urgentAssignments === 1 ? "assignment needs" : "assignments need"} your attention` : "You're all caught up for today"}</span><span>Philippine time</span></div>
              {data.upcomingAssignments.length ? <div className="archive-rows">{data.upcomingAssignments.map((assignment) => <DeadlineRow key={assignment.id} assignment={assignment} now={now} />)}</div> : <EmptyState icon={<CheckCircle2 size={25} />} title="A clear horizon" description="Add a due date to an assignment and it will appear here." href="/dashboard/assignments" linkLabel="Open assignments" />}
            </section>
          </DashboardReveal>
          <DashboardReveal index={2}>
            <section className="archive-panel" aria-labelledby="activity-title">
              <PanelHeading id="activity-title" title="Recently in your workspace" subtitle="A record of what you've been working on" href="/dashboard/activity" linkLabel="View activity" icon={<Activity size={18} />} />
              {data.recentActivity.length ? <div className="archive-rows archive-activity-rows">{data.recentActivity.map((item) => <ActivityPreview key={item.activity_key} item={item} timezone={timezone} />)}</div> : <EmptyState icon={<Clock3 size={24} />} title="Your story starts here" description="Uploads, assignment updates, and other activity will appear as you work." href="/dashboard/files?command=upload" linkLabel="Upload your first file" />}
            </section>
          </DashboardReveal>
        </div>
        <div className="archive-side-column">
          <DashboardReveal index={2}>
            <section className="archive-panel archive-storage" aria-labelledby="storage-title">
              <div className="archive-card-heading"><h2 id="storage-title"><HardDrive size={17} aria-hidden="true" />Storage</h2><Link href="/dashboard/settings" aria-label="Manage storage settings"><ArrowUpRight size={17} /></Link></div>
              <div className="archive-storage-chart">
                <div className="archive-storage-ring" style={{ "--storage-used": `${quotaPercent}%`, "--storage-files": `${filePercent}%` } as CSSProperties} role="img" aria-label={data.quotaBytes > 0 ? `${quotaPercent.toFixed(1)} percent of storage used` : `${formatBytes(summary.total_bytes)} stored; no quota configured`}><div><strong>{data.quotaBytes > 0 ? `${quotaPercent.toFixed(quotaPercent >= 10 ? 0 : 1)}%` : "—"}</strong><span>{data.quotaBytes > 0 ? "used" : "No quota"}</span></div></div>
                <p><strong>{formatBytes(summary.total_bytes)}</strong>{data.quotaBytes > 0 ? ` used of ${formatBytes(data.quotaBytes)}` : " stored"}</p>
              </div>
              <div className="archive-storage-legend"><StorageLine label="Files" value={formatBytes(summary.file_bytes)} color="violet" /><StorageLine label="Videos" value={formatBytes(summary.video_bytes)} color="blue" />{data.quotaBytes > 0 ? <StorageLine label="Available" value={formatBytes(Math.max(0, data.quotaBytes - summary.total_bytes))} color="muted" /> : null}</div>
              {data.quotaBytes > 0 && summary.total_bytes >= data.quotaBytes ? <p className="archive-storage-warning">Storage is full. Free up space or adjust your quota in settings.</p> : null}
              <div className="archive-storage-footer"><Recycle size={14} aria-hidden="true" /><span>Recycle bin</span><Link href="/dashboard/files/recycle">{summary.file_recycle_count.toLocaleString()} {summary.file_recycle_count === 1 ? "file" : "files"}</Link><span aria-hidden="true">·</span><Link href="/dashboard/videos/recycle">{summary.video_recycle_count.toLocaleString()} {summary.video_recycle_count === 1 ? "video" : "videos"}</Link></div>
            </section>
          </DashboardReveal>
          <DashboardReveal index={3}>
            <section className="archive-panel archive-shortcuts" aria-labelledby="shortcuts-title">
              <div className="archive-card-heading"><h2 id="shortcuts-title">Pick up where you need</h2><ArrowUpRight size={16} aria-hidden="true" /></div>
              <QuickAccess href="/dashboard/files/recent" icon={<FolderOpen size={18} />} title="Recent files" detail="Back to your latest work" />
              <QuickAccess href="/dashboard/assignments/productivity" icon={<BellRing size={18} />} title="Reminders" detail="Stay ahead of deadlines" />
              <QuickAccess href="/dashboard/tools" icon={<Wrench size={18} />} title="Archive tools" detail="Convert, edit, and organize" />
            </section>
          </DashboardReveal>
          <div className="archive-private-note"><ShieldCheck size={16} aria-hidden="true" /><p>Your workspace, your control.<br /><Link href="/dashboard/security">Review security settings <ArrowRight size={12} aria-hidden="true" /></Link></p></div>
        </div>
      </div>
      <footer className="archive-page-footer"><span>Damon&apos;s Archive <span aria-hidden="true">/</span> A place for what matters.</span><Link href="/dashboard/settings">Workspace settings <ArrowUpRight size={12} aria-hidden="true" /></Link></footer>
    </div>
  );
}

function PanelHeading({ id, title, subtitle, href, linkLabel, icon }: { id: string; title: string; subtitle: string; href: string; linkLabel: string; icon: ReactNode }) {
  return <div className="archive-panel-heading"><div><h2 id={id}><span aria-hidden="true">{icon}</span>{title}</h2><p>{subtitle}</p></div><Link href={href}>{linkLabel}<ArrowUpRight size={13} aria-hidden="true" /></Link></div>;
}

function EmptyState({ icon, title, description, href, linkLabel }: { icon: ReactNode; title: string; description: string; href: string; linkLabel: string }) {
  return <div className="archive-empty"><span className="archive-empty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p><Link href={href}>{linkLabel}<ArrowRight size={13} aria-hidden="true" /></Link></div>;
}

function DeadlineRow({ assignment, now }: { assignment: DashboardHomeAssignment; now: Date }) {
  const deadline = assignmentDeadlineInfo(assignment, now);
  const dueDate = new Date(`${assignment.due_date}T12:00:00+08:00`);
  const status = assignment.status === "in_progress" ? "In progress" : assignment.status === "blocked" ? "Blocked" : "To do";
  return <Link href={`/dashboard/assignments/${assignment.id}`} className="archive-deadline-row">
    <span className={`archive-date-tile ${deadline.overdue ? "is-overdue" : deadline.isToday ? "is-today" : ""}`} aria-hidden="true"><span>{new Intl.DateTimeFormat("en", { month: "short", timeZone: DEADLINE_TIMEZONE }).format(dueDate)}</span><strong>{new Intl.DateTimeFormat("en", { day: "2-digit", timeZone: DEADLINE_TIMEZONE }).format(dueDate)}</strong></span>
    <span className="archive-row-copy"><strong>{assignment.title}</strong><span>{assignment.subject ? <><span>{assignment.subject}</span><span aria-hidden="true">·</span></> : null}<span className={deadline.overdue ? "archive-text-danger" : deadline.isToday ? "archive-text-amber" : ""}>{deadline.label}</span></span></span>
    <span className="archive-assignment-meta">{assignment.priority === "high" ? <span className="archive-priority">High priority</span> : null}<span className={`archive-task-status is-${assignment.status}`}>{assignment.status === "in_progress" ? <span className="archive-status-dot" /> : assignment.status === "blocked" ? <span aria-hidden="true">!</span> : <span className="archive-open-circle" />}{status}</span></span>
    <ArrowUpRight className="archive-row-arrow" size={16} aria-hidden="true" />
  </Link>;
}

function StorageLine({ label, value, color }: { label: string; value: string; color: string }) {
  return <div><span className={`archive-legend-dot is-${color}`} /><span>{label}</span><strong>{value}</strong></div>;
}

function ActivityPreview({ item, timezone }: { item: WorkspaceActivityItem; timezone: string }) {
  const href = activityHref(item);
  const Icon = item.module === "files" ? FileText : item.module === "assignments" ? ClipboardList : item.module === "videos" ? Film : ShieldCheck;
  const content = <><span className={`archive-activity-icon is-${item.module}`}><Icon size={17} aria-hidden="true" /></span><span className="archive-row-copy"><strong>{workspaceActionLabel(item.action)}</strong><span>{summarizeActivityDetails(item.details)}</span></span><time dateTime={item.created_at}>{formatWorkspaceDateTime(item.created_at, timezone)}</time>{href ? <ArrowUpRight className="archive-row-arrow" size={14} aria-hidden="true" /> : <Check className="archive-row-arrow" size={14} aria-hidden="true" />}</>;
  return href ? <Link href={href} className="archive-activity-row">{content}</Link> : <div className="archive-activity-row">{content}</div>;
}

function QuickAccess({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return <Link className="archive-shortcut" href={href}><span aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link>;
}

function greetingFor(now: Date, timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function firstDisplayName(value: string) {
  const first = value.trim().split(/\s+/)[0] || "there";
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

function assignmentDeadlineInfo(assignment: DashboardHomeAssignment, now: Date) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: DEADLINE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const currentDate = ["year", "month", "day"].map((part) => parts.find((item) => item.type === part)?.value).join("-");
  const [year, month, day] = currentDate.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  const time = assignment.due_time?.slice(0, 5) ?? null;
  const deadline = new Date(`${assignment.due_date}T${time ?? "23:59"}:00+08:00`);
  const overdue = deadline.getTime() < now.getTime();
  const isToday = assignment.due_date === currentDate;
  const timeLabel = time ? new Intl.DateTimeFormat("en", { timeZone: DEADLINE_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(deadline) : "end of day";
  let dateLabel = new Intl.DateTimeFormat("en", { timeZone: DEADLINE_TIMEZONE, month: "short", day: "numeric" }).format(deadline);
  if (isToday) dateLabel = overdue ? "Overdue today" : "Today";
  else if (assignment.due_date === tomorrow) dateLabel = "Tomorrow";
  else if (overdue) dateLabel = `Overdue · ${dateLabel}`;
  return { overdue, isToday, label: `${dateLabel}, ${timeLabel}` };
}

function activityHref(item: WorkspaceActivityItem) {
  if (!item.target_id) return null;
  if (item.module === "files") return `/dashboard/files/${item.target_id}`;
  if (item.module === "assignments") return `/dashboard/assignments/${item.target_id}`;
  if (item.module === "videos") return `/dashboard/videos/${item.target_id}`;
  return null;
}
