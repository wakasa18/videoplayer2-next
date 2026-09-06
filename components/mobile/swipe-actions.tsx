"use client";

import { animate, motion, useMotionValue } from "motion/react";
import type { ReactNode } from "react";
import { useRef } from "react";

export type SwipeAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: "cyan" | "amber" | "green" | "red";
};

type GestureState = {
  x: number;
  y: number;
  base: number;
  axis: "x" | "y" | null;
};

const max = 88;
const openThreshold = 46;

export function MobileSwipeActions({ children, leftActions = [], rightActions = [] }: { children: ReactNode; leftActions?: SwipeAction[]; rightActions?: SwipeAction[] }) {
  const gesture = useRef<GestureState | null>(null);
  const current = useRef(0);
  const x = useMotionValue(0);

  function settle(target: number) {
    current.current = target;
    x.stop();
    animate(x, target, { type: "spring", stiffness: 520, damping: 42, mass: 0.62 });
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    x.stop();
    gesture.current = { x: touch.clientX, y: touch.clientY, base: current.current, axis: null };
  }

  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const state = gesture.current;
    const touch = event.touches[0];
    if (!state || !touch) return;

    const dx = touch.clientX - state.x;
    const dy = touch.clientY - state.y;

    if (!state.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
      state.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
    }
    if (state.axis !== "x") return;

    const next = state.base + dx;
    const allowed = next > 0 ? leftActions.length > 0 : rightActions.length > 0;
    if (!allowed) {
      const resisted = Math.sign(next) * Math.min(14, Math.abs(next) * 0.14);
      current.current = resisted;
      x.set(resisted);
      return;
    }

    const clamped = Math.max(-max, Math.min(max, next));
    current.current = clamped;
    x.set(clamped);
  }

  function onTouchEnd() {
    if (!gesture.current) return;
    const value = current.current;
    settle(Math.abs(value) >= openThreshold ? Math.sign(value) * max : 0);
    gesture.current = null;
  }

  return (
    <div className="mobile-swipe-shell relative isolate overflow-hidden rounded-[22px] bg-[#07111f] lg:overflow-visible lg:bg-transparent">
      <div className="absolute inset-y-0 left-0 z-0 flex w-[88px] items-stretch lg:hidden">
        {leftActions.slice(0, 1).map((action) => <ActionButton key={action.label} action={action} close={() => settle(0)} side="left" />)}
      </div>
      <div className="absolute inset-y-0 right-0 z-0 flex w-[88px] items-stretch lg:hidden">
        {rightActions.slice(0, 1).map((action) => <ActionButton key={action.label} action={action} close={() => settle(0)} side="right" />)}
      </div>
      <motion.div
        className="mobile-swipe-surface relative z-10 rounded-[22px] bg-[#081321] touch-pan-y lg:!transform-none lg:bg-transparent"
        style={{ x }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { gesture.current = null; settle(0); }}
        onClickCapture={(event) => {
          if (Math.abs(current.current) < 2) return;
          event.preventDefault();
          event.stopPropagation();
          settle(0);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function ActionButton({ action, close, side }: { action: SwipeAction; close: () => void; side: "left" | "right" }) {
  const tone = action.tone ?? "cyan";
  const classes = tone === "red"
    ? "border-red-300/20 bg-[#35121a] text-red-200"
    : tone === "amber"
      ? "border-amber-300/20 bg-[#332407] text-amber-100"
      : tone === "green"
        ? "border-emerald-300/20 bg-[#0a3028] text-emerald-100"
        : "border-cyan-300/20 bg-[#073246] text-cyan-100";

  return (
    <motion.button
      type="button"
      onClick={(event) => { event.stopPropagation(); action.onClick(); close(); }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
      className={`flex w-full flex-col items-center justify-center gap-1.5 border px-2 text-[10px] font-bold uppercase tracking-[.08em] shadow-inner ${side === "left" ? "rounded-l-[22px]" : "rounded-r-[22px]"} ${classes}`}
    >
      {action.icon}
      <span>{action.label}</span>
    </motion.button>
  );
}
