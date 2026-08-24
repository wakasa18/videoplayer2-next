"use client";

import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  FolderOpen,
  FlaskConical,
  Home,
  Link2,
  Plus,
  RadioTower,
  Rocket,
  Settings,
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

const links = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/files", label: "Important Files", icon: FolderOpen },
  { href: "/dashboard/files/shares", label: "Shared links", icon: Link2 },
  { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardList },
  {
    href: "/dashboard/assignments/productivity",
    label: "Productivity",
    icon: Sparkles,
  },
  { href: "/dashboard/videos", label: "Videos", icon: Video },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/deployment", label: "Deployment", icon: Rocket },
  { href: "/dashboard/system", label: "System Check", icon: ShieldCheck },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/quality", label: "Quality Assurance", icon: FlaskConical },
];

type SidebarProps = {
  mobile?: boolean;
  onNavigate?: () => void;
  quickModule?: WorkspaceDefaultModule;
};

export function Sidebar({
  mobile = false,
  onNavigate,
  quickModule = "files",
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

  return (
    <aside
      className={
        mobile
          ? "flex h-full w-full flex-col bg-[#07101d]/98 text-slate-100"
          : "tech-sidebar-enter tech-panel sticky top-[5.7rem] hidden h-[calc(100vh-6.6rem)] w-[17rem] shrink-0 flex-col rounded-[1.35rem] px-3 py-4 lg:flex"
      }
    >
      {mobile ? (
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
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
      ) : null}

      <div className="px-1 pb-3">
        <div className="relative overflow-hidden rounded-[1.15rem] border border-cyan-300/15 bg-[linear-gradient(140deg,rgba(25,55,88,0.8),rgba(19,28,49,0.75))] p-3.5 shadow-[0_12px_28px_rgba(0,9,25,0.25)]">
          <div className="tech-scanline" aria-hidden="true" />
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
            className="tech-interactive relative mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-3.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/[0.12]"
          >
            <QuickIcon className="size-4.5 text-cyan-200" aria-hidden="true" />
            {contextual.label}
          </Link>
        </div>
      </div>

      <nav className="tech-nav-stagger space-y-1 overflow-y-auto px-1 py-1" aria-label="Dashboard navigation">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active =
            href === "/dashboard/files"
              ? pathname.startsWith(href) && !pathname.startsWith("/dashboard/files/shares")
              : href === "/dashboard/assignments"
                ? pathname.startsWith(href) &&
                  !pathname.startsWith("/dashboard/assignments/productivity")
                : exact
                  ? pathname === href
                  : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "border-cyan-300/20 bg-[linear-gradient(90deg,rgba(38,210,255,0.15),rgba(81,101,255,0.11))] text-cyan-50 shadow-[0_8px_20px_rgba(0,120,255,0.1)]"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.045] hover:text-white"
              }`}
            >
              {active ? (
                <span className="tech-active-pulse absolute inset-y-2 left-0 w-0.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(63,224,255,0.8)]" />
              ) : null}
              <Icon
                className={`size-4.5 ${active ? "text-cyan-200" : "text-slate-500 group-hover:text-cyan-200"}`}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-1 pt-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <span className="tech-status-dot size-2 rounded-full bg-emerald-400" />
            System online
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <Zap className="size-3 text-cyan-300" /> Phase 11 quality release
          </div>
        </div>
      </div>
    </aside>
  );
}

function quickActionFor(module: WorkspaceDefaultModule) {
  if (module === "home") return { href: "/dashboard", label: "Open dashboard", icon: Home };
  if (module === "assignments") {
    return { href: "/dashboard/assignments", label: "Open assignments", icon: ClipboardList };
  }
  if (module === "videos") return { href: "/dashboard/videos", label: "Open video library", icon: Video };
  if (module === "activity") return { href: "/dashboard/activity", label: "Review activity", icon: Activity };
  return { href: "/dashboard/files", label: "Open files", icon: FolderOpen };
}
