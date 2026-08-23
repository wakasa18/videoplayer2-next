"use client";

import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  FolderOpen,
  Home,
  Link2,
  Orbit,
  Plus,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceDefaultModule } from "@/lib/workspace/types";

const links = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  {
    href: "/dashboard/files",
    label: "Important Files",
    icon: FolderOpen,
  },
  {
    href: "/dashboard/files/shares",
    label: "Shared links",
    icon: Link2,
  },
  {
    href: "/dashboard/assignments",
    label: "Assignments",
    icon: ClipboardList,
  },
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
  const quickHref = contextual.href;
  const QuickIcon = contextual.icon;
  const quickLabel = contextual.label;

  return (
    <aside
      className={
        mobile
          ? "flex h-full w-full flex-col bg-[#090d1d]/95 text-slate-100"
          : "astro-panel sticky top-20 hidden h-[calc(100vh-5rem)] w-72 shrink-0 flex-col rounded-[1.75rem] px-4 py-5 lg:flex"
      }
    >
      {mobile && (
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div>
            <strong className="astro-title text-base font-semibold">Damon&apos;s Archive</strong>
            <p className="astro-soft-text text-xs">Astronomy workspace</p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onNavigate}
            className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="mb-4 px-2">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.25)]">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(83,223,255,0.9),rgba(144,101,255,0.95))] text-slate-950 shadow-[0_10px_24px_rgba(56,189,248,0.2)]">
              <Orbit className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="astro-title text-sm font-semibold">Astral Launch</p>
              <p className="text-xs text-slate-300/70">Explore your galaxy of content</p>
            </div>
          </div>
          <Link
            href={quickHref}
            onClick={onNavigate}
            className="starlight-hover flex min-h-14 items-center gap-3 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(99,223,255,0.16),rgba(122,92,255,0.16))] px-4 text-sm font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <QuickIcon className="size-5 text-cyan-200" aria-hidden="true" />
            {quickLabel}
          </Link>
        </div>
      </div>

      <nav
        className="space-y-1 overflow-y-auto px-2 py-1"
        aria-label="Dashboard navigation"
      >
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active =
            href === "/dashboard/files"
              ? pathname.startsWith(href) &&
                !pathname.startsWith("/dashboard/files/shares")
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
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                active
                  ? "border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(74,222,255,0.16),rgba(168,85,247,0.14))] text-cyan-100 shadow-[0_10px_24px_rgba(14,165,233,0.12)]"
                  : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className={`size-5 ${active ? "text-cyan-200" : "text-slate-400 group-hover:text-cyan-200"}`} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4 pb-2 pt-5 text-xs leading-5 text-slate-400/80">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="astro-title text-xs font-semibold uppercase tracking-[0.24em]">
            Space status
          </div>
          <p className="mt-2 text-slate-300/70">Next.js production workspace · Phase 10</p>
        </div>
      </div>
    </aside>
  );
}

function quickActionFor(module: WorkspaceDefaultModule) {
  if (module === "home") {
    return { href: "/dashboard", label: "Open dashboard", icon: Home };
  }
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
