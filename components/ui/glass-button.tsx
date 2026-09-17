import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  "glass-button liquid-glass-control relative isolate cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 text-inherit transition-[transform,filter,opacity] tech-duration-base tech-ease-spring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        default: "text-base font-medium",
        sm: "text-sm font-medium",
        lg: "text-lg font-medium",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const glassButtonTextVariants = cva(
  "glass-button-text relative z-[2] block select-none tracking-tight",
  {
    variants: {
      size: {
        default: "px-6 py-3.5",
        sm: "px-4 py-2.5",
        lg: "px-8 py-4",
        icon: "flex h-10 w-10 items-center justify-center",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, disabled, ...props }, ref) => {
    return (
      <span
        className={cn("glass-button-wrap rounded-full", className)}
        data-disabled={disabled ? "true" : undefined}
      >
        <button
          className={cn(glassButtonVariants({ size }))}
          ref={ref}
          disabled={disabled}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>
            {children}
          </span>
        </button>
        <span className="glass-button-shadow rounded-full" aria-hidden="true" />
      </span>
    );
  },
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };
