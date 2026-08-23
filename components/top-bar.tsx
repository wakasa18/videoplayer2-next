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
  const assignmentSearch = pathname.startsWith("/dashboard/assignments");
  const videoSearch = pathname.startsWith("/dashboard/videos");
  const activitySearch = pathname.startsWith("/dashboard/activity");
  const searchAction = assignmentSearch
    ? "/dashboard/assignments"
    : videoSearch
      ? "/dashboard/videos"
      : activitySearch
        ? "/dashboard/activity"
        : "/dashboard/files";
  const searchLabel = assignmentSearch
    ? "Search assignments"
    : videoSearch
      ? "Search videos"
      : activitySearch
        ? "Search workspace activity"
        : "Search Important Files";

  return (
    <header className="tech-topbar-enter sticky top-0 z-40 border-b border-white/10 bg-[#050a13]/82 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[1720px] items-center gap-3 px-3 sm:px-5 lg:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="tech-interactive grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <span className="tech-logo-pulse grid size-11 place-items-center rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(35,211,255,0.95),rgba(78,101,255,0.95))] text-[#04101d] shadow-[0_10px_28px_rgba(40,145,255,0.28)]">
            <Cpu className="size-5" aria-hidden="true" />
          </span>
          <div className="hidden sm:block">
            <strong className="tech-title block text-base font-semibold tracking-[-0.02em]">
              Damon&apos;s Archive
            </strong>
            <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-200/55">
              Secure command workspace
            </span>
          </div>
        </div>

        <form
          action={searchAction}
          method="get"
          className="tech-search-focus mx-auto hidden w-full max-w-2xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus-within:border-cyan-300/35 focus-within:bg-white/[0.06]/[0.065] md:flex"
        >
          <Search className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
          <label htmlFor="workspace-search" className="sr-only">
            {searchLabel}
          </label>
          <input
            id="workspace-search"
            name="q"
            type="search"
            placeholder={searchLabel}
            className="h-12 min-w-0 flex-1 border-0 !bg-transparent px-0 text-sm text-slate-100 shadow-none outline-none ring-0 placeholder:text-slate-400/70"
          />
          <span className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 xl:inline-flex">
            <Command className="size-3.5 text-cyan-200" /> Search
          </span>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-1">
            <AssignmentNotificationBell />
          </div>
          <span
            title={`${accountLabel} · ${userEmail}`}
            aria-label={`Signed in as ${accountLabel}`}
            className="tech-avatar-pulse grid size-10 place-items-center rounded-2xl border border-cyan-200/20 bg-[linear-gradient(135deg,#27d3ff,#526dff)] text-sm font-bold text-[#04101d] shadow-[0_8px_22px_rgba(44,149,255,0.22)]"
          >
            {initial}
          </span>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-1">
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
