"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => undefined;

/**
 * Renders modal layers directly under <body> so viewport-fixed overlays are
 * never trapped by transformed/animated cards, page transitions, or filters.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
