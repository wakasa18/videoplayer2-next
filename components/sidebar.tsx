"use client";

import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  FolderOpen,
  Home,
  Link2,
  Plus,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
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
          ? "flex h-full w-full flex-col bg-white"
          : "sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-[#e1e5ea] bg-white px-3 py-5 lg:flex"
      }
    >
      {mobile && (
        <div className="flex h-16 items-center justify-between border-b border-[#e1e5ea] px-4">
          <strong className="text-base font-semibold">Damon&apos;s Archive</strong>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onNavigate}
            className="grid size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="p-3">
        <Link
          href={quickHref}
          onClick={onNavigate}
          className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-5 text-sm font-semibold text-[#202124] shadow-[0_1px_2px_rgba(60,64,67,.16),0_1px_3px_1px_rgba(60,64,67,.08)] transition hover:bg-[#f8f9fa] hover:shadow-md"
        >
          <QuickIcon className="size-5 text-[#1967d2]" aria-hidden="true" />
          {quickLabel}
        </Link>
      </div>

      <nav
        className="space-y-1 overflow-y-auto px-3 py-2"
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
              className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-[#e8f0fe] text-[#1967d2]"
                  : "text-[#3c4043] hover:bg-[#f1f3f4]"
              }`}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-5 pb-5 pt-4 text-xs leading-5 text-[#80868b]">
        Next.js production workspace · Phase 9
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
