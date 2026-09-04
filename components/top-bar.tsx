"use client";

import { Command, Cpu, Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { AssignmentNotificationBell } from "@/components/assignments/assignment-notification-bell";
import { LogoutButton } from "@/components/logout-button";

type TopBarProps = {
  userEmail: string;
  displayName?: string | null;
  onMenuClick: () => void;
};

export function TopBar({ userEmail, displayName, onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const accountLabel = displayName?.trim() || userEmail;
  const initial = accountLabel.trim().charAt(0).toUpperCase() || "A";
  const page = pageDetails(pathname);
  const searchAction = page.searchAction;
  const searchLabel = page.searchLabel;

  return (
    <header className="tech-topbar-enter sticky top-0 z-40 border-b border-white/[0.08] bg-[#050a13]/88 backdrop-blur-2xl supports-[backdrop-filter]:bg-[#050a13]/76">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(49,211,255,0.28),rgba(88,102,255,0.18),transparent)]" />
      <div className="mx-auto flex min-h-[4.5rem] max-w-[1720px] items-center gap-2.5 px-3 sm:px-5 lg:gap-3 lg:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="tech-interactive grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-200 hover:bg-white/[0.085] sm:size-11 lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <span className="tech-logo-pulse grid size-10 place-items-center rounded-xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(35,211,255,0.95),rgba(78,101,255,0.95))] text-[#04101d] shadow-[0_10px_28px_rgba(40,145,255,0.24)] sm:size-11 sm:rounded-2xl">
            <Cpu className="size-5" aria-hidden="true" />
          </span>
          <div className="hidden sm:block">
            <strong className="tech-title block text-[15px] font-semibold tracking-[-0.02em] lg:text-base">
              Damon&apos;s Archive
            </strong>
            <span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-cyan-200/50 lg:text-[11px] lg:tracking-[0.16em]">
              Secure command workspace
            </span>
          </div>
        </div>

        <div className="hidden h-8 w-px shrink-0 bg-white/[0.08] xl:block" />
        <div className="hidden min-w-[9.5rem] xl:block">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current module</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-200">{page.title}</p>
        </div>

        <form
          action={searchAction}
          method="get"
          className="tech-search-focus mx-auto hidden h-11 w-full max-w-xl items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-colors focus-within:border-cyan-300/30 focus-within:bg-white/[0.06] lg:flex xl:max-w-2xl"
        >
          <Search className="size-4.5 shrink-0 text-slate-500" aria-hidden="true" />
          <label htmlFor="workspace-search" className="sr-only">
            {searchLabel}
          </label>
          <input
            id="workspace-search"
            name="q"
            type="search"
            placeholder={searchLabel}
            className="h-full min-w-0 flex-1 border-0 !bg-transparent px-0 text-sm text-slate-100 shadow-none outline-none ring-0 placeholder:text-slate-500"
          />
          <span className="hidden items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-slate-400 2xl:inline-flex">
            <Command className="size-3 text-cyan-200/80" /> Search
          </span>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-300/10 bg-emerald-300/[0.045] px-2 py-1.5 2xl:flex">
            <span className="tech-status-dot size-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300/75">Online</span>
          </div>

          <AssignmentNotificationBell />

          <div
            title={`${accountLabel} · ${userEmail}`}
            aria-label={`Signed in as ${accountLabel}`}
            className="flex h-10 items-center rounded-xl border border-white/[0.09] bg-white/[0.035] p-1 pr-1 sm:h-11 sm:pr-2.5"
          >
            <span className="tech-avatar-pulse grid size-8 place-items-center rounded-lg border border-cyan-200/20 bg-[linear-gradient(135deg,#27d3ff,#526dff)] text-xs font-bold text-[#04101d] shadow-[0_8px_22px_rgba(44,149,255,0.18)] sm:size-9 sm:rounded-xl sm:text-sm">
              {initial}
            </span>
            <span className="ml-2 hidden min-w-0 max-w-[10rem] xl:block">
              <strong className="block truncate text-[11px] font-semibold leading-4 text-slate-200">
                {accountLabel}
              </strong>
              <span className="block truncate text-[9px] leading-3 text-slate-500">Signed in</span>
            </span>
          </div>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

function pageDetails(pathname: string) {
  if (pathname.startsWith("/dashboard/files/shares")) {
    return {
      title: "Shared links",
      searchAction: "/dashboard/files",
      searchLabel: "Search Important Files",
    };
  }
  if (pathname.startsWith("/dashboard/files")) {
    return {
      title: "Important Files",
      searchAction: "/dashboard/files",
      searchLabel: "Search Important Files",
    };
  }
  if (pathname.startsWith("/dashboard/assignments/productivity")) {
    return {
      title: "Productivity",
      searchAction: "/dashboard/assignments",
      searchLabel: "Search assignments",
    };
  }
  if (pathname.startsWith("/dashboard/assignments")) {
    return {
      title: "Assignments",
      searchAction: "/dashboard/assignments",
      searchLabel: "Search assignments",
    };
  }
  if (pathname.startsWith("/dashboard/videos")) {
    return {
      title: "Videos",
      searchAction: "/dashboard/videos",
      searchLabel: "Search videos",
    };
  }
  if (pathname.startsWith("/dashboard/activity")) {
    return {
      title: "Activity",
      searchAction: "/dashboard/activity",
      searchLabel: "Search workspace activity",
    };
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return { title: "Settings", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/deployment")) {
    return { title: "Deployment", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/system")) {
    return { title: "System Check", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/maintenance")) {
    return { title: "Maintenance", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/quality")) {
    return { title: "Quality Assurance", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/handoff")) {
    return { title: "Final Handoff", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  return {
    title: "Dashboard",
    searchAction: "/dashboard/files",
    searchLabel: "Search Important Files",
  };
}
