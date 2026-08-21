"use client";

import {
  ClipboardList,
  FolderOpen,
  Home,
  Plus,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  {
    href: "/dashboard/files",
    label: "Important Files",
    icon: FolderOpen,
  },
  {
    href: "/dashboard/assignments",
    label: "Assignments",
    icon: ClipboardList,
  },
  { href: "/dashboard/videos", label: "Videos", icon: Video },
];

type SidebarProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

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
          href="/dashboard/files"
          onClick={onNavigate}
          className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-5 text-sm font-semibold text-[#202124] shadow-[0_1px_2px_rgba(60,64,67,.16),0_1px_3px_1px_rgba(60,64,67,.08)] transition hover:bg-[#f8f9fa] hover:shadow-md"
        >
          <Plus className="size-5 text-[#1967d2]" aria-hidden="true" />
          Open files
        </Link>
      </div>

      <nav className="space-y-1 px-3 py-2" aria-label="Dashboard navigation">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);

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
        Next.js migration workspace
      </div>
    </aside>
  );
}
