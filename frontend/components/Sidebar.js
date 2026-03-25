"use client";

import Link from "next/link";
import { LayoutDashboard, History, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/results", label: "Results", icon: LineChart },
  { href: "/dashboard#history", label: "History", icon: History }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-24 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <p className="mb-3 text-xs uppercase tracking-widest text-slate-400">Workspace</p>
        <div className="space-y-1">
          {links.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                  active ? "bg-emerald-500/20 text-emerald-200" : "text-slate-200 hover:bg-white/10"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
