"use client";

import { Archive, ArrowRight, Menu, Search } from "@/components/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AssignmentNotificationBell } from "@/components/assignments/assignment-notification-bell";
import { LogoutButton } from "@/components/logout-button";
import { TopBarQuickActions } from "@/components/topbar-quick-actions";

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
    <header className="topbar-shell tech-topbar-enter sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="topbar-frame mx-auto flex min-h-[4.25rem] max-w-[1760px] items-center gap-2.5 px-2.5 sm:min-h-[4.5rem] sm:px-5 lg:gap-3 lg:px-6">
        <button
          type="button"
          data-no-glass
          data-liquid-glass
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="topbar-icon-button grid size-10 shrink-0 place-items-center lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <Link
          href="/dashboard"
          data-no-glass
          className="topbar-brand-group group shrink-0"
          aria-label="Open Damon&apos;s Archive dashboard"
        >
          <span
            id="topbar-brand-logo"
            className="topbar-brand-logo"
          >
            <Archive size={21} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <strong className="tech-title block truncate text-[14px] font-semibold tracking-[-0.025em] lg:text-[15px]">
              Damon&apos;s Archive
            </strong>
            <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.17em] text-primary/45 lg:text-[10px]">
              A place for what matters
            </span>
          </span>
        </Link>

        <div className="topbar-module hidden min-w-0 2xl:flex">
          <span className="topbar-module-dot" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-primary/40">
              Workspace
            </span>
            <strong className="mt-0.5 block max-w-[10rem] truncate text-[11px] font-semibold text-slate-200">
              {page.title}
            </strong>
          </span>
        </div>

        <form
          action={searchAction}
          method="get"
          className="topbar-search mx-auto hidden h-10 w-full max-w-[460px] items-center lg:flex"
        >
          <Search className="ml-4 size-[18px] shrink-0 text-primary/45" aria-hidden="true" />
          <label htmlFor="workspace-search" className="sr-only">
            {searchLabel}
          </label>
          <input
            id="workspace-search"
            name="q"
            type="search"
            placeholder={searchLabel}
            className="h-full min-w-0 flex-1 border-0 !bg-transparent px-3 text-[13px] text-slate-100 shadow-none outline-none ring-0 placeholder:text-slate-500"
          />
          <button
            type="submit"
            data-no-glass
            data-liquid-glass
            className="topbar-search-submit mr-1.5 inline-flex h-7 items-center gap-1.5 rounded-md px-2"
            aria-label={`Search ${page.title}`}
          >
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </form>

        <div className="topbar-actions ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button type="button" data-no-glass className="topbar-icon-button grid size-10 place-items-center lg:hidden" onClick={() => window.dispatchEvent(new Event("damons:open-command-palette"))} aria-label="Search workspace"><Search size={18} aria-hidden="true" /></button>

          <TopBarQuickActions />

          <AssignmentNotificationBell />

          <Link
            href="/dashboard/settings"
            title={`${accountLabel} · ${userEmail}`}
            aria-label={`Signed in as ${accountLabel}`}
            className="topbar-account max-[420px]:hidden"
          >
            <span className="topbar-avatar">{initial}</span>
            <span className="hidden min-w-0 max-w-[9rem] 2xl:block">
              <strong className="block truncate text-[10px] font-semibold leading-4 text-slate-100">
                {accountLabel}
              </strong>
              <span className="block truncate text-[8px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Signed in
              </span>
            </span>
          </Link>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

function pageDetails(pathname: string) {
  if (pathname.startsWith("/dashboard/tools")) {
    return { title: "Tools", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/files/recent")) {
    return { title: "Recent Files", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/assignments/reminders")) {
    return { title: "Reminder History", searchAction: "/dashboard/assignments", searchLabel: "Search assignments" };
  }
  if (pathname.startsWith("/dashboard/notes")) {
    return { title: "Notes", searchAction: "/dashboard/notes", searchLabel: "Search notes" };
  }
  if (pathname.startsWith("/dashboard/security")) {
    return { title: "Security Center", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
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
    return { title: "System Health", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/maintenance")) {
    return { title: "Maintenance", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/quality")) {
    return { title: "Quality Assurance", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  if (pathname.startsWith("/dashboard/handoff")) {
    return { title: "Release Handoff", searchAction: "/dashboard/files", searchLabel: "Search Important Files" };
  }
  return {
    title: "Dashboard",
    searchAction: "/dashboard/files",
    searchLabel: "Search Important Files",
  };
}
