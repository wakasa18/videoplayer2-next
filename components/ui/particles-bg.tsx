"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

type ParticleInstance = {
  pJS: {
    canvas: { el: HTMLCanvasElement; w: number; h: number; pxratio: number };
    tmp: { retina: boolean; checkAnimFrame?: number };
    particles: { array: unknown[] };
    interactivity: {
      status: string;
      mouse: { pos_x: number | null; pos_y: number | null };
    };
    fn: {
      drawAnimFrame?: number;
      checkAnimFrame?: number;
      vendors: { densityAutoParticles: () => void };
      modes: { pushParticles: (count: number, position: { pos_x: number; pos_y: number }) => void };
    };
  };
};

type ParticlesWindow = Window & {
  particlesJS?: (id: string, options: Record<string, unknown>) => void;
  pJSDom?: ParticleInstance[];
};

let scriptPromise: Promise<void> | undefined;

function loadParticles() {
  const runtime = window as ParticlesWindow;
  if (runtime.particlesJS) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        scriptPromise = undefined;
        reject(new Error("Could not load particles.js"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Place inside a relative container; the default background fills one screen. */
export default function ParticlesComponent({ className, viewportInteraction = false }: { className?: string; viewportInteraction?: boolean }) {
  const id = `particles-${useId().replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const runtime = window as ParticlesWindow;
    const html = document.documentElement;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let instance: ParticleInstance | undefined;
    let previousDark: boolean | undefined;
    let observer: MutationObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const clearPointer = () => {
      if (!instance) return;
      instance.pJS.interactivity.status = "mouseleave";
      instance.pJS.interactivity.mouse.pos_x = null;
      instance.pJS.interactivity.mouse.pos_y = null;
    };
    const trackPointer = (event: MouseEvent) => {
      if (!instance || document.hidden) return null;
      const bounds = container.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) {
        clearPointer();
        return null;
      }
      const ratio = instance.pJS.tmp.retina ? instance.pJS.canvas.pxratio : 1;
      const position = { pos_x: x * ratio, pos_y: y * ratio };
      Object.assign(instance.pJS.interactivity.mouse, position);
      instance.pJS.interactivity.status = "mousemove";
      return position;
    };
    const pushParticles = (event: MouseEvent) => {
      // Keyboard activation and app actions keep their normal behavior.
      if (!event.detail || (event.target instanceof Element && event.target.closest("button, a, input, textarea, select, summary, [role='button'], [role='dialog'], [role='alertdialog'], [contenteditable='true']"))) return;
      const position = trackPointer(event);
      if (position && instance) {
        const count = Math.min(4, Math.max(0, 300 - instance.pJS.particles.array.length));
        if (count) instance.pJS.fn.modes.pushParticles(count, position);
      }
    };
    if (viewportInteraction) {
      document.addEventListener("pointermove", trackPointer, { passive: true });
      document.addEventListener("click", pushParticles, { passive: true });
      document.documentElement.addEventListener("pointerleave", clearPointer);
      window.addEventListener("blur", clearPointer);
    }

    const destroy = () => {
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      if (!instance) return;
      const { fn, tmp, canvas } = instance.pJS;
      for (const frame of [fn.drawAnimFrame, fn.checkAnimFrame, tmp.checkAnimFrame]) {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
      }
      canvas.el.remove();
      // The library's destroy method clears every instance, including siblings.
      runtime.pJSDom = runtime.pJSDom?.filter((item) => item !== instance);
      instance = undefined;
    };

    const initialize = () => {
      const isDark = html.classList.contains("dark") || html.dataset.theme === "dark";
      if (disposed || !runtime.particlesJS) return;
      if (instance && previousDark === isDark && !motion.matches) return;
      destroy();
      previousDark = isDark;
      if (motion.matches) return;
      const colors = isDark
        ? { particles: "#00f5ff", lines: "#00d9ff", accent: "#0096c7" }
        : { particles: "#0277bd", lines: "#0288d1", accent: "#039be5" };

      runtime.particlesJS(id, {
        particles: {
          number: { value: 140, density: { enable: true, value_area: 800 } },
          color: { value: colors.particles },
          shape: { type: "circle", stroke: { width: 0.5, color: colors.accent } },
          opacity: { value: 0.7, random: true, anim: { enable: true, speed: 1, opacity_min: 0.3 } },
          size: { value: 3, random: true, anim: { enable: true, speed: 2, size_min: 1 } },
          line_linked: { enable: true, distance: 160, color: colors.lines, opacity: 0.4, width: 1.2 },
          move: { enable: true, speed: 2, random: true, out_mode: "bounce" },
        },
        interactivity: {
          detect_on: "canvas",
          events: {
            onhover: { enable: true, mode: "grab" },
            onclick: { enable: !viewportInteraction, mode: "push" },
            // Own the resize listener so it can be disconnected on unmount.
            resize: false,
          },
          modes: {
            grab: { distance: 220, line_linked: { opacity: 0.8 } },
            push: { particles_nb: 4 },
            repulse: { distance: 180, duration: 0.4 },
          },
        },
        retina_detect: true,
      });
      instance = runtime.pJSDom?.find((item) => item.pJS.canvas.el.parentElement === container);
      resizeObserver = new ResizeObserver(() => {
        if (!instance) return;
        const { canvas, tmp, fn } = instance.pJS;
        const ratio = tmp.retina ? canvas.pxratio : 1;
        canvas.w = container.clientWidth * ratio;
        canvas.h = container.clientHeight * ratio;
        canvas.el.width = canvas.w;
        canvas.el.height = canvas.h;
        fn.vendors.densityAutoParticles();
      });
      resizeObserver.observe(container);
    };

    void loadParticles().then(() => {
      if (disposed) return;
      initialize();
      observer = new MutationObserver(initialize);
      observer.observe(html, { attributes: true, attributeFilter: ["class", "data-theme"] });
      motion.addEventListener("change", initialize);
    }).catch(() => {
      // Keep the gradient usable if the CDN cannot be reached.
      destroy();
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      motion.removeEventListener("change", initialize);
      document.removeEventListener("pointermove", trackPointer);
      document.removeEventListener("click", pushParticles);
      document.documentElement.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("blur", clearPointer);
      destroy();
    };
  }, [id, viewportInteraction]);

  return (
    <div
      ref={containerRef}
      id={id}
      aria-hidden="true"
      className={cn(
        "absolute left-0 top-0 h-screen w-full overflow-hidden bg-gradient-to-tr from-[#e3f2fd] via-[#90caf9] to-[#64b5f6] transition-colors duration-500 dark:from-[#000814] dark:via-[#003566] dark:to-[#0077b6] [&>canvas]:block",
        className,
      )}
    />
  );
}
