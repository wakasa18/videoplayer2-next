import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 starlight-hover",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-300/30 bg-[linear-gradient(135deg,rgba(98,229,255,0.95),rgba(94,126,255,0.92))] text-slate-950 shadow-[0_10px_25px_rgba(58,129,255,0.28)] hover:brightness-110",
        destructive:
          "border border-red-300/25 bg-[linear-gradient(135deg,rgba(251,113,133,0.95),rgba(239,68,68,0.88))] text-white shadow-[0_10px_25px_rgba(239,68,68,0.2)] hover:brightness-105",
        outline:
          "border border-white/12 bg-white/5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/10",
        secondary:
          "border border-fuchsia-300/15 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_8px_20px_rgba(168,85,247,0.14)] hover:bg-fuchsia-400/15",
        ghost: "border border-transparent text-slate-200 hover:bg-white/8 hover:text-white",
        link: "rounded-none border-none px-0 text-cyan-200 shadow-none hover:text-cyan-100 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
