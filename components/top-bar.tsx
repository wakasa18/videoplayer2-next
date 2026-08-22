"use client";

import { Cloud, Menu, Search } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-[#e1e5ea] bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="grid size-10 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#1a73e8] to-[#5e97f6] text-white shadow-sm">
            <Cloud className="size-5" aria-hidden="true" />
          </span>
          <strong className="hidden text-lg font-semibold tracking-[-0.02em] text-[#202124] sm:block">
            Damon&apos;s Archive
          </strong>
        </div>

        <form
          action={searchAction}
          method="get"
          className="mx-auto hidden w-full max-w-2xl items-center gap-3 rounded-full bg-[#f1f3f4] px-4 transition focus-within:bg-white focus-within:shadow-[0_1px_2px_rgba(60,64,67,.16),0_1px_3px_1px_rgba(60,64,67,.08)] md:flex"
        >
          <Search className="size-5 shrink-0 text-[#5f6368]" aria-hidden="true" />
          <label htmlFor="workspace-search" className="sr-only">
            {searchLabel}
          </label>
          <input
            id="workspace-search"
            name="q"
            type="search"
            placeholder={searchLabel}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#202124] outline-none placeholder:text-[#80868b]"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <AssignmentNotificationBell />
          <span
            title={`${accountLabel} · ${userEmail}`}
            aria-label={`Signed in as ${accountLabel}`}
            className="grid size-9 place-items-center rounded-full bg-[#1a73e8] text-sm font-semibold text-white"
          >
            {initial}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
