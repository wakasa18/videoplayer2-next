import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "glass-control liquid-glass-control tech-interactive inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform,filter,opacity] tech-duration-base tech-ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:pointer-events-none disabled:opacity-50 [&_.lordicon-icon]:pointer-events-none [&_.lordicon-icon]:size-4 [&_.lordicon-icon]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "glass-control-primary border-primary/25 text-white",
        destructive:
          "glass-control-danger border-red-300/25 text-white",
        outline:
          "glass-control-secondary border-white/12 text-slate-100",
        secondary:
          "glass-control-secondary border-primary/18 text-primary",
        ghost: "glass-control-ghost border-transparent text-slate-300 hover:text-white",
        link: "glass-control-link rounded-none border-none px-0 text-primary shadow-none hover:text-primary hover:underline",
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
