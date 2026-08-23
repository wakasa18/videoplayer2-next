"use client";

import {
  Activity,
  ClipboardCheck,
  Film,
  FolderOpen,
  HardDrive,
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
  "clipboard-check": ClipboardCheck,
  film: Film,
  "folder-open": FolderOpen,
  "hard-drive": HardDrive,
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
}: {
  index: number;
  icon: DashboardIconName;
  label: string;
  value: string;
  description: string;
  tint: Tint;
}) {
  const Icon = dashboardIcons[icon];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="tech-panel tech-interactive group rounded-[24px] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <strong className="mt-2 block truncate text-2xl font-semibold tracking-tight text-slate-100">
            {value}
          </strong>
        </div>
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${tints[tint]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">{description}</p>
    </motion.article>
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
        <span className={`grid size-12 place-items-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 ${tints[tint]}`}>
          <Icon className="size-5" />
        </span>
        <h2 className="mt-4 flex items-center gap-1.5 text-lg font-semibold text-slate-100">
          {title}
          <span className="text-cyan-300 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">→</span>
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </Link>
    </motion.div>
  );
}
