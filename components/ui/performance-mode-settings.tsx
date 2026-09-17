"use client";

import { Gauge, Sparkles, Zap } from "@/components/ui/icons";
import { useSyncExternalStore } from "react";

import {
  getStoredUIPerformanceMode,
  setUIPerformanceMode,
  UI_PERFORMANCE_EVENT,
  UI_PERFORMANCE_STORAGE_KEY,
  type UIPerformanceMode,
} from "@/components/ui/ui-performance-controller";

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === UI_PERFORMANCE_STORAGE_KEY) callback();
  };
  const handleModeChange = () => callback();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(UI_PERFORMANCE_EVENT, handleModeChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(UI_PERFORMANCE_EVENT, handleModeChange);
  };
}

function getServerSnapshot(): UIPerformanceMode {
  return "full";
}

export function PerformanceModeSettings() {
  const mode = useSyncExternalStore(
    subscribe,
    getStoredUIPerformanceMode,
    getServerSnapshot,
  );

  return (
    <section className="tech-card rounded-[24px] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Gauge className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">UI performance mode</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                The workspace uses a static background and lightweight surfaces. Choose how much motion you prefer.
              </p>
            </div>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-slate-300">
          {mode === "lite" ? <Zap className="size-3.5" /> : <Sparkles className="size-3.5" />}
          {mode === "lite" ? "Lite Mode on" : "Standard motion"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ModeButton
          active={mode === "full"}
          title="Standard motion"
          description="Brief transitions and Lordicon animations when you interact. No animated background or glass blur."
          icon={<Sparkles className="size-5" aria-hidden="true" />}
          onClick={() => setUIPerformanceMode("full")}
        />
        <ModeButton
          active={mode === "lite"}
          title="Lite Mode"
          description="Keep icons static and reduce transitions further for a quieter, faster workspace."
          icon={<Zap className="size-5" aria-hidden="true" />}
          onClick={() => setUIPerformanceMode("lite")}
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        This preference is saved only in this browser. The system will not switch modes automatically based on your phone, PC, RAM, CPU, or network connection.
      </p>
    </section>
  );
}

function ModeButton({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group min-h-28 rounded-[20px] border p-4 text-left transition ${
        active
          ? "border-primary/35 bg-primary/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_12px_30px_rgba(73,20,110,.16)]"
          : "border-white/10 bg-white/[0.025] hover:border-primary/25 hover:bg-primary/[0.055]"
      }`}
    >
      <span className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl border ${
          active
            ? "border-primary/25 bg-primary/15 text-primary"
            : "border-white/10 bg-white/[0.035] text-slate-400 group-hover:text-primary"
        }`}>
          {icon}
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-100">{title}</span>
          <span className="mt-1.5 block text-xs leading-5 text-slate-400">{description}</span>
        </span>
      </span>
    </button>
  );
}
