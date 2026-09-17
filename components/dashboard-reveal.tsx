import {
  Activity,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  ClipboardCheck,
  Film,
  FolderOpen,
  HardDrive,
  Link2,
  Settings,
  ShieldCheck,
} from "@/components/ui/icons";

import Link from "next/link";
import type { ReactNode } from "react";

import { GlowCard } from "@/components/ui/spotlight-card";

const tints = {
  cyan: "bg-primary/10 text-primary border-primary/20",
  indigo: "bg-primary/10 text-primary border-primary/20",
  pink: "bg-pink-400/10 text-pink-300 border-pink-300/20",
  amber: "bg-amber-400/10 text-amber-300 border-amber-300/20",
  emerald: "bg-emerald-400/10 text-emerald-300 border-emerald-300/20",
} as const;

type Tint = keyof typeof tints;

const dashboardIcons = {
  activity: Activity,
  "bell-ring": BellRing,
  "calendar-clock": CalendarClock,
  "clipboard-check": ClipboardCheck,
  film: Film,
  "folder-open": FolderOpen,
  "hard-drive": HardDrive,
  link: Link2,
  settings: Settings,
  "shield-check": ShieldCheck,
} as const;

type DashboardIconName = keyof typeof dashboardIcons;

export function DashboardReveal({ children }: { children: ReactNode; index?: number }) {
  return (
    <div
      className="min-w-0"



    >
      {children}
    </div>
  );
}

export function DashboardStatCard({
  icon,
  label,
  value,
  description,
  tint,
  href,
}: {
  index: number;
  icon: DashboardIconName;
  label: string;
  value: string;
  description: string;
  tint: Tint;
  href?: string;
}) {
  const Icon = dashboardIcons[icon];
  const content = (
    <>
      <div className="archive-collection-top"><span className="archive-collection-icon"><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span>{href ? <ArrowUpRight size={16} className="archive-collection-arrow" aria-hidden="true" /> : null}</div>
      <div className="archive-collection-value"><strong>{value}</strong><span>{label}</span></div>
      <p className="archive-collection-description">{description}</p>
    </>
  );

  return (
    <div
      className="h-full min-w-0"



    >
        {href ? (
          <Link
            href={href}
            className={`archive-collection is-${tint}`}
          >
            {content}
          </Link>
        ) : (
          <article className={`archive-collection is-${tint}`}>
            {content}
          </article>
        )}
    </div>
  );
}

export function DashboardQuickLink({
  href,
  icon,
  tint,
  title,
  description,
}: {
  index: number;
  href: string;
  icon: DashboardIconName;
  tint: Tint;
  title: string;
  description: string;
}) {
  const Icon = dashboardIcons[icon];

  return (
    <div
      className="h-full"



    >
      <GlowCard
        glowColor="purple"
        customSize
        className="h-full w-full !gap-0 !rounded-[20px] !p-0 sm:!rounded-[24px]"
      >
        <Link href={href} className="tech-interactive group block h-full rounded-[20px] bg-white/[0.012] p-4 sm:rounded-[24px] sm:p-6">
          <span
            className={`grid size-12 place-items-center rounded-2xl border transition-transform duration-200  ${tints[tint]}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 flex items-center gap-1.5 text-lg font-semibold text-slate-100">
            {title}
            <span className="text-primary opacity-0 transition-[transform,opacity] duration-200  group-hover:opacity-100">
              →
            </span>
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </Link>
      </GlowCard>
    </div>
  );
}
