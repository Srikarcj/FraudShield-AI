"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/authContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/results", label: "Results" },
  { href: "/explainability", label: "Explain" },
  { href: "/reports", label: "Reports" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" }
];

function initialsFromEmail(email) {
  if (!email) return "U";
  const base = String(email).split("@")[0] || "U";
  return base.slice(0, 2).toUpperCase();
}

function isActivePath(pathname, href) {
  if (!pathname || !href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out.");
      setMenuOpen(false);
    } catch {
      toast.error("Sign out failed.");
    }
  };

  const userEmail = user?.email || user?.user_metadata?.email || "";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="w-full flex items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-white">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <span className="font-semibold tracking-wide">FraudShield AI</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-end gap-3 text-sm text-slate-200 md:flex">
          <div className="flex max-w-[52vw] items-center gap-1 overflow-x-auto whitespace-nowrap rounded-md border border-white/10 bg-white/5 px-2 py-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs transition",
                  isActivePath(pathname, link.href)
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {loading ? null : user ? (
            <>
              <span className="hidden max-w-[200px] truncate text-xs text-slate-300 xl:inline">{userEmail}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                {initialsFromEmail(userEmail)}
              </span>
              <Button size="sm" variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-1 h-4 w-4" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth?mode=signin"><Button size="sm" variant="outline">Sign In</Button></Link>
              <Link href="/auth?mode=signup"><Button size="sm">Sign Up</Button></Link>
            </>
          )}
        </nav>

        <Button
          className="md:hidden"
          size="icon"
          variant="outline"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {menuOpen ? (
        <div className="border-t border-white/10 bg-slate-950/95 px-4 py-3 md:hidden">
          <div className="w-full space-y-3 text-sm text-slate-200">
            <div className="grid grid-cols-2 gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-center text-xs",
                    isActivePath(pathname, link.href)
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {loading ? null : user ? (
              <>
                <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 truncate">{userEmail}</div>
                <Button size="sm" variant="outline" onClick={handleSignOut}>
                  <LogOut className="mr-1 h-4 w-4" /> Sign Out
                </Button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/auth?mode=signin"><Button size="sm" variant="outline" className="w-full">Sign In</Button></Link>
                <Link href="/auth?mode=signup"><Button size="sm" className="w-full">Sign Up</Button></Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
