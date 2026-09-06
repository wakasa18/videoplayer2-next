import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "tech-interactive inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform,filter,opacity] duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-200/20 bg-[linear-gradient(135deg,#2ad4ff,#4e6cff)] text-[#04101d] shadow-[0_10px_24px_rgba(40,137,255,0.23)] hover:brightness-110",
        destructive:
          "border border-red-300/20 bg-[linear-gradient(135deg,#fb7185,#ef4444)] text-white shadow-[0_10px_24px_rgba(239,68,68,0.16)] hover:brightness-105",
        outline:
          "border border-white/10 bg-white/[0.045] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-white/[0.075]",
        secondary:
          "border border-indigo-300/15 bg-indigo-400/10 text-indigo-100 hover:bg-indigo-400/15",
        ghost: "border border-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white",
        link: "rounded-none border-none px-0 text-cyan-200 shadow-none hover:text-cyan-100 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-7",
        icon: "h-10 w-10",
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
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
