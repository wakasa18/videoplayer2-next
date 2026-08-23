"use client";

import { CloudMoon, Menu, Search, Stars } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b18]/72 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[1680px] items-center gap-3 px-3 sm:px-5 lg:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(76,224,255,1),rgba(137,92,255,0.96))] text-slate-950 shadow-[0_10px_25px_rgba(37,99,235,0.25)]">
            <CloudMoon className="size-5" aria-hidden="true" />
          </span>
          <div className="hidden sm:block">
            <strong className="astro-title block text-lg font-semibold tracking-[-0.02em]">
              Damon&apos;s Archive
            </strong>
            <span className="block text-xs text-slate-300/60">Celestial workspace</span>
          </div>
        </div>

        <form
          action={searchAction}
          method="get"
          className="mx-auto hidden w-full max-w-2xl items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus-within:border-cyan-300/30 focus-within:bg-white/8 md:flex"
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
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-400/70"
          />
          <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 lg:inline-flex">
            <Stars className="size-3.5 text-cyan-200" /> Quick find
          </span>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="rounded-full border border-white/10 bg-white/5 p-1">
            <AssignmentNotificationBell />
          </div>
          <span
            title={`${accountLabel} · ${userEmail}`}
            aria-label={`Signed in as ${accountLabel}`}
            className="grid size-10 place-items-center rounded-full bg-[linear-gradient(135deg,rgba(94,229,255,0.94),rgba(130,92,255,0.94))] text-sm font-semibold text-slate-950 shadow-[0_8px_22px_rgba(56,189,248,0.25)]"
          >
            {initial}
          </span>
          <div className="rounded-full border border-white/10 bg-white/5 px-1 py-1">
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
