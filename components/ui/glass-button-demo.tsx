"use client";

import { Zap } from "@/components/ui/icons";

import { GlassButton } from "@/components/ui/glass-button";

function DottedBackground() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="100%"
      width="100%"
      className="pointer-events-none absolute inset-0 z-0 opacity-50"
      aria-hidden="true"
    >
      <defs>
        <pattern patternUnits="userSpaceOnUse" height="30" width="30" id="glassButtonDottedGrid">
          <circle fill="currentColor" className="text-primary/30" r="1" cy="2" cx="2" />
        </pattern>
      </defs>
      <rect fill="url(#glassButtonDottedGrid)" height="100%" width="100%" />
    </svg>
  );
}

export function Default() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-8 overflow-hidden bg-card p-10">
      <DottedBackground />
      <div className="relative z-10 text-center">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <GlassButton size="sm">Small</GlassButton>
          <GlassButton size="default" contentClassName="flex items-center justify-center gap-2">
            <span>Generate</span>
            <Zap className="h-5 w-5" aria-hidden="true" />
          </GlassButton>
          <GlassButton size="lg">Submit</GlassButton>
          <GlassButton size="icon" aria-label="Generate">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

export default Default;
