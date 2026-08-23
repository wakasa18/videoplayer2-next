"use client";

import { motion } from "motion/react";
import { Cpu } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden p-6 md:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(39,211,255,0.12), transparent 38%), radial-gradient(circle at 82% 78%, rgba(91,115,255,0.14), transparent 42%)",
        }}
      />
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 flex flex-col items-center gap-3 text-center"
        >
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
