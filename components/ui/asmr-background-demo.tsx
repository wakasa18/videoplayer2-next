"use client";

import ASMRStaticBackground from "@/components/ui/asmr-background";

/**
 * Standalone showcase for the ASMR background component.
 * The production app mounts only ASMRStaticBackground behind AppShell.
 */
export default function ASMRBackgroundDemo() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-card">
      <ASMRStaticBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6 pointer-events-none">
        <div className="rounded-xl border border-primary/10 bg-primary/[0.025] px-8 py-5 text-center shadow-2xl backdrop-blur-md">
          <h2 className="text-sm font-light uppercase tracking-[0.45em] text-primary/45 md:text-xl md:tracking-[0.7em]">
            Atmospheric Friction
          </h2>
          <div className="my-4 h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
          <p className="text-[10px] font-medium tracking-[0.2em] text-primary/20">
            INTERACTIVE KINETIC ENVIRONMENT
          </p>
        </div>
      </div>
    </div>
  );
}
