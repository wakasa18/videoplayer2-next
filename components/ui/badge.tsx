import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300/30",
  {
    variants: {
      variant: {
        default: "border-cyan-300/18 bg-cyan-400/10 text-cyan-100",
        secondary: "border-indigo-300/15 bg-indigo-400/10 text-indigo-100",
        destructive: "border-red-300/15 bg-red-400/10 text-red-100",
        outline: "border-white/10 bg-white/[0.035] text-slate-200",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
