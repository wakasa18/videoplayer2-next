"use client";

import { RefreshCw } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function PullToRefresh() {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  const distanceRef = useRef(0);
  const distance = useMotionValue(0);
  const y = useTransform(distance, (value) => Math.max(-40, value - 44));
  const rotate = useTransform(distance, (value) => value * 2.35);
  const opacity = useTransform(distance, [0, 8, 42, 72], [0, 0, 0.55, 1]);
  const scale = useTransform(distance, [0, 28, 72], [0.82, 0.92, 1]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      if (window.scrollY > 1 || refreshing) return;
      const touch = event.touches[0];
      if (touch) start.current = { x: touch.clientX, y: touch.clientY };
    };
    const onMove = (event: TouchEvent) => {
      if (!start.current || window.scrollY > 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      if (dy <= 0 || Math.abs(dx) > dy * 0.8) return;
      const next = Math.min(105, dy * 0.46);
      distanceRef.current = next;
      distance.set(next);
    };
    const onEnd = () => {
      if (!start.current) return;
      if (distanceRef.current >= 72) {
        setRefreshing(true);
        distance.stop();
        animate(distance, 58, { type: "spring", stiffness: 420, damping: 34 });
        router.refresh();
        window.setTimeout(() => {
          setRefreshing(false);
          animate(distance, 0, { type: "spring", stiffness: 440, damping: 38 });
        }, 700);
      } else {
        distance.stop();
        animate(distance, 0, { type: "spring", stiffness: 500, damping: 40 });
      }
      start.current = null;
      distanceRef.current = 0;
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [distance, refreshing, router]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.55rem] z-30 h-0 lg:hidden" aria-live="polite">
      <motion.div
        className="mx-auto grid size-10 place-items-center rounded-full border border-cyan-300/20 bg-[#07111f]/95 text-cyan-200 shadow-lg"
        style={{ y, rotate, opacity, scale }}
      >
        <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
      </motion.div>
    </div>
  );
}
