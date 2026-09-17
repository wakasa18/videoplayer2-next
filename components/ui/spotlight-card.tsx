import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

type GlowColor = "blue" | "purple" | "green" | "red" | "orange";
type GlowSize = "sm" | "md" | "lg";

interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  glowColor?: GlowColor;
  size?: GlowSize;
  width?: string | number;
  height?: string | number;
  /** When true, sizing is controlled by width/height or className. */
  customSize?: boolean;
}

const glowColorMap: Record<GlowColor, { rgb: string; borderRgb: string }> = {
  blue: { rgb: "59 130 246", borderRgb: "147 197 253" },
  purple: { rgb: "168 85 247", borderRgb: "216 180 254" },
  green: { rgb: "34 197 94", borderRgb: "134 239 172" },
  red: { rgb: "239 68 68", borderRgb: "252 165 165" },
  orange: { rgb: "249 115 22", borderRgb: "253 186 116" },
};

const sizeMap: Record<GlowSize, string> = {
  sm: "h-64 w-48",
  md: "h-80 w-64",
  lg: "h-96 w-80",
};

type GlowStyle = CSSProperties & {
  "--spotlight-rgb": string;
  "--spotlight-border-rgb": string;
};

/**
 * Spotlight-enabled card surface.
 * Pointer tracking is handled once by SpotlightController at the app root.
 */
const GlowCard = ({
  children,
  className,
  glowColor = "purple",
  size = "md",
  width,
  height,
  customSize = false,
}: GlowCardProps) => {
  const colors = glowColorMap[glowColor];
  const style: GlowStyle = {
    "--spotlight-rgb": colors.rgb,
    "--spotlight-border-rgb": colors.borderRgb,
  };

  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      data-spotlight-card
      data-spotlight-active="false"
      style={style}
      className={cn(
        "tech-panel spotlight-card relative overflow-hidden",
        !customSize && sizeMap[size],
        !customSize && "aspect-[3/4]",
        "grid grid-rows-[1fr_auto] gap-4 rounded-2xl p-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

export { GlowCard };
export type { GlowCardProps, GlowColor, GlowSize };
