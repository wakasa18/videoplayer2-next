"use client";

import { useEffect, useSyncExternalStore } from "react";

export type UIPerformanceMode = "full" | "lite";

export const UI_PERFORMANCE_STORAGE_KEY = "damons-archive-ui-performance-mode";
export const UI_PERFORMANCE_EVENT = "ui-performance-mode-change";

// All icons share one set of browser listeners instead of subscribing per icon.
const motionSubscribers = new Set<() => void>();
let motionEnabled = false;
let stopMotionSubscription: (() => void) | undefined;
function subscribeMotion(listener: () => void) {
  motionSubscribers.add(listener);
  if (motionSubscribers.size === 1) {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const next = !query.matches && !document.hidden && getStoredUIPerformanceMode() !== "lite";
      if (next === motionEnabled) return;
      motionEnabled = next;
      motionSubscribers.forEach((notify) => notify());
    };
    query.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener(UI_PERFORMANCE_EVENT, update);
    window.addEventListener("storage", update);
    update();
    stopMotionSubscription = () => {
      query.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener(UI_PERFORMANCE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }
  return () => {
    motionSubscribers.delete(listener);
    if (!motionSubscribers.size) stopMotionSubscription?.();
  };
}
export function useUIMotionEnabled() {
  return useSyncExternalStore(subscribeMotion, () => motionEnabled, () => false);
}

export function getStoredUIPerformanceMode(): UIPerformanceMode {
  if (typeof window === "undefined") return "full";

  try {
    return window.localStorage.getItem(UI_PERFORMANCE_STORAGE_KEY) === "lite"
      ? "lite"
      : "full";
  } catch {
    return "full";
  }
}

function applyUIPerformanceMode(mode: UIPerformanceMode) {
  const root = document.documentElement;

  // Both modes use the lightweight theme; Lite also suppresses icon playback.
  if (mode === "lite") {
    root.dataset.uiPerformance = "lite";
  } else {
    delete root.dataset.uiPerformance;
  }
}

export function setUIPerformanceMode(mode: UIPerformanceMode) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(UI_PERFORMANCE_STORAGE_KEY, mode);
  } catch {
    // The mode still applies for the current tab if storage is unavailable.
  }

  applyUIPerformanceMode(mode);
  window.dispatchEvent(
    new CustomEvent(UI_PERFORMANCE_EVENT, { detail: { mode } }),
  );
}

/**
 * Restores the saved motion preference without reintroducing background effects.
 */
export function UIPerformanceController() {
  useEffect(() => {
    const sync = () => applyUIPerformanceMode(getStoredUIPerformanceMode());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === UI_PERFORMANCE_STORAGE_KEY) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      delete document.documentElement.dataset.uiPerformance;
    };
  }, []);

  return null;
}
