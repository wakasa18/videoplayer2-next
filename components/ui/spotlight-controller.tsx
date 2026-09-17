"use client";

import { useEffect } from "react";

const SURFACE_SELECTOR = ".tech-card, .tech-panel, .tech-panel-soft, [data-spotlight-card]";

type SpotlightSurface = HTMLElement & {
  dataset: DOMStringMap & { spotlightActive?: string };
};

function resolveSurface(target: EventTarget | null): SpotlightSurface | null {
  if (!(target instanceof Element)) return null;
  const surface = target.closest(SURFACE_SELECTOR);
  return surface instanceof HTMLElement ? (surface as SpotlightSurface) : null;
}

function setInactive(surface: SpotlightSurface | null) {
  if (!surface) return;
  surface.dataset.spotlightActive = "false";
}

/**
 * One pointer controller powers the spotlight effect for hydrated workspace
 * surfaces. Listener registration is intentionally deferred until after the
 * AppShell has committed, preventing DOM mutations during React hydration.
 */
export function SpotlightController() {
  useEffect(() => {
    let disposed = false;
    let listenersAttached = false;
    let bootstrapFrame: number | null = null;
    let bootstrapTimer: number | null = null;
    let activeSurface: SpotlightSurface | null = null;
    let frameId: number | null = null;
    let queuedSurface: SpotlightSurface | null = null;
    let queuedX = 0;
    let queuedY = 0;
    let touchTimer: number | null = null;

    const paint = () => {
      frameId = null;
      const surface = queuedSurface;
      if (!surface || !surface.isConnected) return;

      if (surface !== activeSurface) {
        setInactive(activeSurface);
        activeSurface = surface;
      }

      const rect = surface.getBoundingClientRect();
      const x = Math.max(0, Math.min(queuedX - rect.left, rect.width));
      const y = Math.max(0, Math.min(queuedY - rect.top, rect.height));

      surface.style.setProperty("--spotlight-x", `${x.toFixed(1)}px`);
      surface.style.setProperty("--spotlight-y", `${y.toFixed(1)}px`);
      surface.style.setProperty(
        "--spotlight-xp",
        (x / Math.max(rect.width, 1)).toFixed(3),
      );
      surface.style.setProperty(
        "--spotlight-yp",
        (y / Math.max(rect.height, 1)).toFixed(3),
      );
      surface.dataset.spotlightActive = "true";
    };

    const queuePaint = (
      surface: SpotlightSurface,
      clientX: number,
      clientY: number,
    ) => {
      queuedSurface = surface;
      queuedX = clientX;
      queuedY = clientY;
      if (frameId === null) frameId = window.requestAnimationFrame(paint);
    };

    const isLiteMode = () =>
      document.documentElement.dataset.uiPerformance === "lite";

    const handlePointerMove = (event: PointerEvent) => {
      if (isLiteMode()) {
        clearActive();
        return;
      }
      if (event.pointerType === "touch") return;
      const surface = resolveSurface(event.target);
      if (!surface) {
        setInactive(activeSurface);
        activeSurface = null;
        queuedSurface = null;
        return;
      }
      queuePaint(surface, event.clientX, event.clientY);
    };

    const handlePointerOver = (event: PointerEvent) => {
      if (isLiteMode()) return;
      if (event.pointerType === "touch") return;
      const surface = resolveSurface(event.target);
      if (surface) queuePaint(surface, event.clientX, event.clientY);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isLiteMode()) return;
      const surface = resolveSurface(event.target);
      if (!surface) return;
      queuePaint(surface, event.clientX, event.clientY);

      if (event.pointerType === "touch") {
        if (touchTimer !== null) window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(() => {
          setInactive(surface);
          if (activeSurface === surface) activeSurface = null;
        }, 700);
      }
    };

    const clearActive = () => {
      setInactive(activeSurface);
      activeSurface = null;
      queuedSurface = null;
    };

    const handlePerformanceModeChange = () => {
      if (isLiteMode()) clearActive();
    };

    const attachListeners = () => {
      if (disposed || listenersAttached) return;
      listenersAttached = true;
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      document.addEventListener("pointerover", handlePointerOver, { passive: true });
      document.addEventListener("pointerdown", handlePointerDown, { passive: true });
      window.addEventListener("blur", clearActive);
      document.documentElement.addEventListener("mouseleave", clearActive);
      window.addEventListener("ui-performance-mode-change", handlePerformanceModeChange);
    };

    // AppShell is a client boundary. Waiting one animation frame plus a
    // macrotask guarantees its server-rendered descendants have finished
    // hydration before this controller is allowed to mutate their attributes.
    bootstrapFrame = window.requestAnimationFrame(() => {
      bootstrapTimer = window.setTimeout(attachListeners, 0);
    });

    return () => {
      disposed = true;
      if (bootstrapFrame !== null) window.cancelAnimationFrame(bootstrapFrame);
      if (bootstrapTimer !== null) window.clearTimeout(bootstrapTimer);
      if (listenersAttached) {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerover", handlePointerOver);
        document.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("blur", clearActive);
        document.documentElement.removeEventListener("mouseleave", clearActive);
        window.removeEventListener("ui-performance-mode-change", handlePerformanceModeChange);
      }
      clearActive();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (touchTimer !== null) window.clearTimeout(touchTimer);
    };
  }, []);

  return null;
}
