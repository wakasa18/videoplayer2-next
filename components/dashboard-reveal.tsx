"use client";

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
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

const tints = {
  cyan: "bg-cyan-400/10 text-cyan-300 border-cyan-300/20",
  indigo: "bg-indigo-400/10 text-indigo-300 border-indigo-300/20",
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

export function DashboardReveal({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardStatCard({
  index,
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <strong className="mt-2.5 block truncate text-2xl font-semibold tracking-tight text-slate-100 sm:text-[1.7rem]">
            {value}
          </strong>
        </div>
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${tints[tint]}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xs leading-5 text-slate-400">{description}</p>
        {href ? (
          <ArrowUpRight
            className="size-4 shrink-0 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.08 + index * 0.055, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {href ? (
        <Link href={href} className="tech-panel tech-interactive group block h-full rounded-[24px] p-5">
          {content}
        </Link>
      ) : (
        <article className="tech-panel group h-full rounded-[24px] p-5">{content}</article>
      )}
    </motion.div>
  );
}

export function DashboardQuickLink({
  index,
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={href} className="tech-panel tech-interactive group block rounded-[24px] p-6">
        <span
          className={`grid size-12 place-items-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 ${tints[tint]}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 flex items-center gap-1.5 text-lg font-semibold text-slate-100">
          {title}
          <span className="text-cyan-300 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
            →
          </span>
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </Link>
    </motion.div>
  );
}
