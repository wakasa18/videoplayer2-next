"use client";

import {
  Activity,
  BadgeCheck,
  BookOpenCheck,
  ClipboardList,
  FolderOpen,
  FileClock,
  FlaskConical,
  Home,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RadioTower,
  Rocket,
  Settings,
  History,
  ShieldCheck,
  Sparkles,
  Wrench,
  Video,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceDefaultModule } from "@/lib/workspace/types";

type NavigationLink = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const workspaceLinks: NavigationLink[] = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/files", label: "Important Files", icon: FolderOpen },
  { href: "/dashboard/files/recent", label: "Recent Files", icon: FileClock },
  { href: "/dashboard/files/shares", label: "Shared links", icon: Link2 },
  { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/dashboard/assignments/productivity", label: "Productivity", icon: Sparkles },
  { href: "/dashboard/assignments/reminders", label: "Reminder History", icon: History },
  { href: "/dashboard/videos", label: "Videos", icon: Video },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
];

const systemLinks: NavigationLink[] = [
  { href: "/dashboard/security", label: "Security Center", icon: ShieldCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/deployment", label: "Deployment", icon: Rocket },
  { href: "/dashboard/system", label: "System Health", icon: ShieldCheck },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/quality", label: "Quality Assurance", icon: FlaskConical },
  { href: "/dashboard/handoff", label: "Final Handoff", icon: BadgeCheck },
];

type SidebarProps = {
  mobile?: boolean;
  onNavigate?: () => void;
  quickModule?: WorkspaceDefaultModule;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function Sidebar({
  mobile = false,
  onNavigate,
  quickModule = "files",
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const assignmentArea = pathname.startsWith("/dashboard/assignments");
  const videoArea = pathname.startsWith("/dashboard/videos");
  const fileArea = pathname.startsWith("/dashboard/files");
  const preferred = quickActionFor(quickModule);
  const contextual = assignmentArea
    ? { href: "/dashboard/assignments", label: "Browse assignments", icon: BookOpenCheck }
    : videoArea
      ? { href: "/dashboard/videos", label: "Open video library", icon: Video }
      : fileArea
        ? { href: "/dashboard/files", label: "Open files", icon: Plus }
        : preferred;
  const QuickIcon = contextual.icon;
  const isCompact = collapsed && !mobile;

  return (
    <aside
      className={
        mobile
          ? "flex h-full w-full flex-col overflow-hidden rounded-[1.5rem] border border-cyan-200/15 bg-[#07101d]/98 text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
          : `tech-sidebar-enter tech-panel sticky top-[5.55rem] hidden h-[calc(100dvh-6.45rem)] shrink-0 flex-col rounded-[1.35rem] py-3.5 transition-[width,padding] duration-300 ease-[cubic-bezier(.16,1,.3,1)] lg:flex ${
              isCompact ? "w-[5.35rem] px-2.5" : "w-[17rem] px-3"
            }`
      }
      aria-label="Primary navigation"
    >
      {mobile ? (
        <div className="flex h-[4.4rem] shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div>
            <strong className="tech-title text-base font-semibold">Damon&apos;s Archive</strong>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-cyan-200/55">
              Command navigation
            </p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onNavigate}
            className="tech-interactive grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className={`mb-2 flex items-center ${isCompact ? "justify-center" : "justify-between px-1"}`}>
          {!isCompact ? (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Navigation
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Workspace control</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCompact ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
            className="tech-interactive grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-cyan-100"
          >
            {isCompact ? (
              <PanelLeftOpen className="size-4.5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4.5" aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      <div className={isCompact ? "px-0 pb-2" : "px-1 pb-3"}>
        <div
          className={`relative overflow-hidden border border-cyan-300/15 bg-[linear-gradient(140deg,rgba(25,55,88,0.8),rgba(19,28,49,0.75))] shadow-[0_12px_28px_rgba(0,9,25,0.25)] ${
            isCompact ? "rounded-2xl p-2" : "rounded-[1.15rem] p-3.5"
          }`}
        >
          <div className="tech-scanline" aria-hidden="true" />
          {isCompact ? (
            <Link
              href={contextual.href}
              onClick={onNavigate}
              title={contextual.label}
              aria-label={contextual.label}
              className="tech-interactive relative grid size-11 w-full place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100 hover:bg-cyan-300/[0.13]"
            >
              <QuickIcon className="size-5 text-cyan-200" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <div className="relative flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200">
                  <RadioTower className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">Quick command</p>
                  <p className="truncate text-xs text-slate-400">Open your active workspace</p>
                </div>
              </div>
              <Link
                href={contextual.href}
                onClick={onNavigate}
                className="tech-interactive relative mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-3.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/[0.12]"
              >
                <QuickIcon className="size-4.5 text-cyan-200" aria-hidden="true" />
                {contextual.label}
              </Link>
            </>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-1" aria-label="Dashboard navigation">
        <NavigationGroup
          label="Workspace"
          links={workspaceLinks}
          pathname={pathname}
          collapsed={isCompact}
          onNavigate={onNavigate}
        />
        <div className={`my-3 border-t border-white/[0.07] ${isCompact ? "mx-2" : "mx-1"}`} />
        <NavigationGroup
          label="System"
          links={systemLinks}
          pathname={pathname}
          collapsed={isCompact}
          onNavigate={onNavigate}
        />
      </nav>

      <div className={isCompact ? "mt-auto px-0 pt-3" : "mt-auto px-1 pt-4"}>
        {isCompact ? (
          <div
            title="System online · Selected feature upgrade"
            className="grid place-items-center rounded-xl border border-white/10 bg-white/[0.035] py-3"
          >
            <span className="tech-status-dot size-2.5 rounded-full bg-emerald-400" />
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="tech-status-dot size-2 rounded-full bg-emerald-400" />
                System online
              </div>
              <span className="rounded-md border border-emerald-300/10 bg-emerald-300/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-300/80">
                Live
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <Zap className="size-3 text-cyan-300" /> Selected feature upgrade
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

type NavigationGroupProps = {
  label: string;
  links: NavigationLink[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
};

function NavigationGroup({
  label,
  links,
  pathname,
  collapsed,
  onNavigate,
}: NavigationGroupProps) {
  return (
    <div>
      {!collapsed ? (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
      ) : null}
      <div className="tech-nav-stagger space-y-1">
        {links.map(({ href, label: linkLabel, icon: Icon, exact }) => {
          const active = isActivePath(pathname, href, exact);

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? linkLabel : undefined}
              aria-label={collapsed ? linkLabel : undefined}
              className={`group relative flex items-center rounded-xl border text-sm font-medium transition-all ${
                collapsed ? "h-11 justify-center px-0" : "gap-3 px-3.5 py-2.5"
              } ${
                active
                  ? "border-cyan-300/20 bg-[linear-gradient(90deg,rgba(38,210,255,0.15),rgba(81,101,255,0.11))] text-cyan-50 shadow-[0_8px_20px_rgba(0,120,255,0.1)]"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.045] hover:text-white"
              }`}
            >
              {active ? (
                <span
                  className={`tech-active-pulse absolute rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(63,224,255,0.8)] ${
                    collapsed ? "left-0 top-1/2 h-5 w-0.5 -translate-y-1/2" : "inset-y-2 left-0 w-0.5"
                  }`}
                />
              ) : null}
              <Icon
                className={`size-4.5 shrink-0 transition-colors ${
                  active ? "text-cyan-200" : "text-slate-500 group-hover:text-cyan-200"
                }`}
                aria-hidden="true"
              />
              {!collapsed ? <span className="truncate">{linkLabel}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (href === "/dashboard/files") {
    return pathname.startsWith(href) && !pathname.startsWith("/dashboard/files/shares") && !pathname.startsWith("/dashboard/files/recent");
  }
  if (href === "/dashboard/assignments") {
    return (
      pathname.startsWith(href) &&
      !pathname.startsWith("/dashboard/assignments/productivity") &&
      !pathname.startsWith("/dashboard/assignments/reminders")
    );
  }
  return exact ? pathname === href : pathname.startsWith(href);
}

function quickActionFor(module: WorkspaceDefaultModule) {
  if (module === "home") return { href: "/dashboard", label: "Open dashboard", icon: Home };
  if (module === "assignments") {
    return { href: "/dashboard/assignments", label: "Open assignments", icon: ClipboardList };
  }
  if (module === "videos") {
    return { href: "/dashboard/videos", label: "Open video library", icon: Video };
  }
  if (module === "activity") {
    return { href: "/dashboard/activity", label: "Review activity", icon: Activity };
  }
  return { href: "/dashboard/files", label: "Open files", icon: FolderOpen };
}
