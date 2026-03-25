import { cn } from "@/lib/utils";

const variants = {
  default: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  destructive: "bg-red-500/20 text-red-200 border-red-400/30",
  outline: "bg-transparent text-slate-200 border-white/20"
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
