import { cn } from "@/lib/utils";

export function Table({ className, ...props }) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-white/10", className)} {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn("border-b border-white/10 transition-colors hover:bg-white/5", className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return <th className={cn("h-10 px-3 text-left align-middle font-medium text-slate-300", className)} {...props} />;
}

export function TableCell({ className, ...props }) {
  return <td className={cn("p-3 align-middle text-slate-100", className)} {...props} />;
}
