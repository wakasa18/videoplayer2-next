"use client";

import { MotionConfig, motion } from "motion/react";
import { Database, HardDrive, ShieldCheck } from "@/components/ui/icons";
import type { ReactNode } from "react";

import { LordIcon } from "@/components/ui/lord-icon";

const securitySignals = [
  { icon: ShieldCheck, label: "Protected session", detail: "Hardened sign-in flow" },
  { icon: Database, label: "Private data", detail: "Workspace-only access" },
  { icon: HardDrive, label: "Archive ready", detail: "Files stay organized" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <main className="auth-shell relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-7 sm:px-6 md:p-10">
        <div className="auth-shell-vignette pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />
        <div className="auth-shell-grid pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />

        <div className="relative z-10 grid w-full max-w-[1080px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-14">
          <motion.section
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <div className="auth-brand-row mb-9 flex items-center gap-3.5">
              <span id="auth-brand-desktop" className="auth-brand-logo tech-logo-pulse">
                <LordIcon
                  name="brand"
                  size={25}
                  active
                  targetId="auth-brand-desktop"
                  className="text-primary"
                />
              </span>
              <div>
                <strong className="tech-title block text-[17px] font-semibold tracking-[-0.025em]">
                  Damon&apos;s Archive
                </strong>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Secure command workspace
                </span>
              </div>
            </div>

            <div className="max-w-[560px]">
              <div className="auth-kicker">
                <span className="tech-status-dot size-1.5 rounded-full bg-primary" />
                Private workspace gateway
              </div>
              <h2 className="tech-title mt-5 max-w-[540px] text-[42px] font-semibold leading-[1.04] tracking-[-0.05em] xl:text-[50px]">
                One secure place for your files, tasks, and digital workspace.
              </h2>
              <p className="mt-5 max-w-[500px] text-[14px] leading-7 text-slate-400">
                Sign in once to access your archive, assignments, videos, shared links, browser tools, and workspace activity from the same private control center.
              </p>
            </div>

            <div className="mt-9 grid max-w-[590px] grid-cols-3 gap-3">
              {securitySignals.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="auth-signal-card">
                  <span className="auth-signal-icon">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-200">{label}</p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="auth-telemetry mt-6 max-w-[590px]">
              <span><i className="bg-emerald-400" />System online</span>
              <span><i className="bg-primary" />Encrypted session</span>
              <span><i className="bg-primary/70" />Private access</span>
            </div>
          </motion.section>

          <div className="w-full max-w-[440px] justify-self-center lg:justify-self-end">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mb-5 flex items-center gap-3 lg:hidden"
            >
              <span id="auth-brand-mobile" className="auth-brand-logo tech-logo-pulse !size-11 !rounded-[15px]">
                <LordIcon
                  name="brand"
                  size={21}
                  active
                  targetId="auth-brand-mobile"
                  className="text-primary"
                />
              </span>
              <div>
                <strong className="tech-title block text-base font-semibold tracking-[-0.025em]">
                  Damon&apos;s Archive
                </strong>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Secure command workspace
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.32, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}
