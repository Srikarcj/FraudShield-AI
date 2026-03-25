import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default: "bg-emerald-600 text-white hover:bg-emerald-500",
  secondary: "bg-slate-800 text-white hover:bg-slate-700",
  outline: "border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10",
  ghost: "bg-transparent text-slate-200 hover:bg-white/10",
  destructive: "bg-red-600 text-white hover:bg-red-500"
};

const sizeVariants = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 text-sm",
  lg: "h-11 px-8",
  icon: "h-10 w-10"
};

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        sizeVariants[size],
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
