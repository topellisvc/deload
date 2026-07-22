import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-lg border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
