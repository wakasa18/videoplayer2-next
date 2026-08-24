"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";

export function PerformanceMonitor() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    const payload = JSON.stringify({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
      path: pathname,
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(
        "/api/quality/vitals",
        new Blob([payload], { type: "application/json" }),
      );
      if (sent) return;
    }

    void fetch("/api/quality/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  });

  return null;
}
