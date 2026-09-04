"use client";

import { motion } from "motion/react";
import { Cpu, Database, HardDrive, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const securitySignals = [
  { icon: ShieldCheck, label: "Protected session" },
  { icon: Database, label: "Private data layer" },
  { icon: HardDrive, label: "Secure archive access" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-6 sm:px-6 md:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(circle at 14% 10%, rgba(39,211,255,0.13), transparent 34%), radial-gradient(circle at 86% 82%, rgba(91,115,255,0.14), transparent 38%), linear-gradient(180deg,#07101d 0%,#050b15 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(92,154,205,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(92,154,205,.16) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, black, transparent 82%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[14%] -z-10 h-px w-[min(82vw,900px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent"
      />

      <div className="grid w-full max-w-[980px] items-center gap-8 lg:grid-cols-[1fr_430px] lg:gap-12">
        <motion.section
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <div className="mb-8 flex items-center gap-3">
            <span className="tech-logo-pulse grid size-12 place-items-center rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(35,211,255,0.95),rgba(78,101,255,0.95))] text-[#04101d] shadow-[0_10px_28px_rgba(40,145,255,0.28)]">
              <Cpu className="size-6" aria-hidden="true" />
            </span>
            <div>
              <strong className="tech-title block text-lg font-semibold tracking-[-0.02em]">
                Damon&apos;s Archive
              </strong>
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-200/55">
                Secure command workspace
              </span>
            </div>
          </div>

          <div className="max-w-lg">
            <p className="tech-label text-[11px] font-semibold">Private workspace gateway</p>
            <h2 className="tech-title mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-[44px]">
              Your archive, assignments, and workspace in one secure place.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              Access the same high-tech workspace used to manage important files, videos, reminders, shares, and system activity.
            </p>
          </div>

          <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {securitySignals.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="tech-panel-soft flex items-center gap-3 rounded-2xl px-3.5 py-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-cyan-400/[0.08] text-cyan-300">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium leading-4 text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <div className="w-full max-w-[430px] justify-self-center lg:justify-self-end">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 flex items-center gap-3 lg:hidden"
          >
            <span className="tech-logo-pulse grid size-11 place-items-center rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(35,211,255,0.95),rgba(78,101,255,0.95))] text-[#04101d] shadow-[0_10px_28px_rgba(40,145,255,0.28)]">
              <Cpu className="size-5" aria-hidden="true" />
            </span>
            <div>
              <strong className="tech-title block text-base font-semibold tracking-[-0.02em]">
                Damon&apos;s Archive
              </strong>
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200/50">
                Secure command workspace
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
