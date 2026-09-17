"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type ASMRStaticBackgroundProps = {
  className?: string;
  particleCount?: number;
  interactive?: boolean;
};

/**
 * ASMRStaticBackground
 *
 * High-density canvas particles with a magnetic vortex interaction.
 * This production version is tuned for Damon's Archive:
 * - dark-purple glass/charcoal palette
 * - responsive particle density
 * - capped DPR for mobile/GPU efficiency
 * - reduced-motion support
 * - visibility-aware animation loop
 * - pointer-events-none so it never blocks the application UI
 */
export function ASMRStaticBackground({
  className,
  particleCount = 1000,
  interactive = true,
}: ASMRStaticBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const canvasElement: HTMLCanvasElement = canvas;
    const context: CanvasRenderingContext2D = ctx;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrameId = 0;
    let particles: Particle[] = [];
    let running = true;
    let reducedMotion = false;
    let liteMode = document.documentElement.dataset.uiPerformance === "lite";
    let lastFrameAt = 0;

    const mouse = { x: -1000, y: -1000, active: false };

    const MAGNETIC_RADIUS = 280;
    const VORTEX_STRENGTH = 0.07;
    const PULL_STRENGTH = 0.12;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    class Particle {
      x = 0;
      y = 0;
      vx = 0;
      vy = 0;
      size = 0;
      alpha = 0;
      color = "";
      rotation = 0;
      rotationSpeed = 0;
      frictionGlow = 0;

      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.45 + 0.45;
        this.vx = (Math.random() - 0.5) * 0.18;
        this.vy = (Math.random() - 0.5) * 0.18;

        // Mostly charcoal dust with occasional violet/white glass shards.
        const glassRoll = Math.random();
        if (glassRoll > 0.88) {
          this.color = "233, 213, 255";
        } else if (glassRoll > 0.7) {
          this.color = "192, 132, 252";
        } else {
          this.color = "89, 76, 102";
        }

        this.alpha = Math.random() * 0.32 + 0.08;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.045;
        this.frictionGlow = 0;
      }

      update() {
        if (interactive && mouse.active && !reducedMotion && !liteMode) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distSquared = dx * dx + dy * dy;

          if (distSquared > 0.0001 && distSquared < MAGNETIC_RADIUS * MAGNETIC_RADIUS) {
            const dist = Math.sqrt(distSquared);
            const force = (MAGNETIC_RADIUS - dist) / MAGNETIC_RADIUS;
            const normalizedX = dx / dist;
            const normalizedY = dy / dist;

            // Magnetic center pull.
            this.vx += normalizedX * force * PULL_STRENGTH;
            this.vy += normalizedY * force * PULL_STRENGTH;

            // Perpendicular velocity creates the vortex orbit.
            this.vx += normalizedY * force * VORTEX_STRENGTH * 10;
            this.vy -= normalizedX * force * VORTEX_STRENGTH * 10;

            this.frictionGlow = Math.max(this.frictionGlow, force * 0.72);
          } else {
            this.frictionGlow *= 0.92;
          }
        } else {
          this.frictionGlow *= 0.92;
        }

        this.x += this.vx;
        this.y += this.vy;

        this.vx *= 0.95;
        this.vy *= 0.95;

        if (!reducedMotion) {
          this.vx += (Math.random() - 0.5) * 0.035;
          this.vy += (Math.random() - 0.5) * 0.035;
        }

        this.rotation +=
          this.rotationSpeed + (Math.abs(this.vx) + Math.abs(this.vy)) * 0.045;

        if (this.x < -20) this.x = width + 20;
        if (this.x > width + 20) this.x = -20;
        if (this.y < -20) this.y = height + 20;
        if (this.y > height + 20) this.y = -20;
      }

      draw() {
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.rotation);

        const finalAlpha = Math.min(this.alpha + this.frictionGlow, 0.9);
        context.fillStyle = `rgba(${this.color}, ${finalAlpha})`;

        if (!liteMode && this.frictionGlow > 0.25) {
          context.shadowBlur = 10 * this.frictionGlow;
          context.shadowColor = `rgba(192, 132, 252, ${this.frictionGlow})`;
        }

        context.beginPath();
        context.moveTo(0, -this.size * 2.5);
        context.lineTo(this.size, 0);
        context.lineTo(0, this.size * 2.5);
        context.lineTo(-this.size, 0);
        context.closePath();
        context.fill();
        context.restore();
      }
    }

    function getResponsiveParticleCount() {
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const cores = navigator.hardwareConcurrency || 4;

      let cap = particleCount;
      if (width < 640 || coarsePointer) cap = Math.min(cap, 360);
      else if (width < 1024) cap = Math.min(cap, 620);
      else if (width < 1440) cap = Math.min(cap, 820);

      if (cores <= 4) cap = Math.min(cap, 500);
      if (reducedMotion) cap = Math.min(cap, 180);
      if (liteMode) cap = Math.min(cap, width < 768 ? 140 : 260);

      return Math.max(liteMode ? 80 : 120, cap);
    }

    function drawFrame(advancePhysics = true) {
      // A translucent deep-plum wash creates the ASMR motion trail.
      context.fillStyle = reducedMotion ? "rgba(10, 4, 16, 0.92)" : "rgba(10, 4, 16, 0.2)";
      context.fillRect(0, 0, width, height);

      for (const particle of particles) {
        if (advancePhysics) particle.update();
        particle.draw();
      }
    }

    function init() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = liteMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);

      canvasElement.width = Math.max(1, Math.floor(width * dpr));
      canvasElement.height = Math.max(1, Math.floor(height * dpr));
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = Array.from({ length: getResponsiveParticleCount() }, () => new Particle());
      context.clearRect(0, 0, width, height);
      drawFrame(!reducedMotion);
    }

    function render(now: number) {
      if (!running || document.hidden || reducedMotion) return;

      if (liteMode && now - lastFrameAt < 50) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      lastFrameAt = now;
      drawFrame(true);
      animationFrameId = window.requestAnimationFrame(render);
    }

    function restartLoop() {
      window.cancelAnimationFrame(animationFrameId);
      if (!running || document.hidden || reducedMotion) return;
      animationFrameId = window.requestAnimationFrame(render);
    }

    function handlePointerMove(clientX: number, clientY: number) {
      mouse.x = clientX;
      mouse.y = clientY;
      mouse.active = true;
    }

    function handleMouseMove(event: MouseEvent) {
      handlePointerMove(event.clientX, event.clientY);
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) handlePointerMove(touch.clientX, touch.clientY);
    }

    function handlePointerLeave() {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    }

    function handleVisibilityChange() {
      if (!document.hidden) restartLoop();
    }

    function handleMotionPreference(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
      init();
      restartLoop();
    }

    function handlePerformanceModeChange() {
      const nextLiteMode =
        document.documentElement.dataset.uiPerformance === "lite";
      if (nextLiteMode === liteMode) return;

      liteMode = nextLiteMode;
      lastFrameAt = 0;
      handlePointerLeave();
      init();
      restartLoop();
    }

    reducedMotion = motionQuery.matches;
    init();
    restartLoop();

    window.addEventListener("resize", init, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("blur", handlePointerLeave);
    document.addEventListener("mouseleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    motionQuery.addEventListener("change", handleMotionPreference);
    window.addEventListener("ui-performance-mode-change", handlePerformanceModeChange);

    return () => {
      running = false;
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("blur", handlePointerLeave);
      document.removeEventListener("mouseleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      motionQuery.removeEventListener("change", handleMotionPreference);
      window.removeEventListener("ui-performance-mode-change", handlePerformanceModeChange);
    };
  }, [interactive, particleCount]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-0 overflow-hidden bg-card",
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block size-full opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_8%,rgba(168,85,247,0.13),transparent_30%),radial-gradient(circle_at_8%_65%,rgba(126,34,206,0.09),transparent_32%),linear-gradient(180deg,rgba(10,4,16,0.04),rgba(10,4,16,0.48))]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,4,16,0.42),transparent_18%,transparent_82%,rgba(10,4,16,0.38))]" />
    </div>
  );
}

export const Component = ASMRStaticBackground;
export default ASMRStaticBackground;
