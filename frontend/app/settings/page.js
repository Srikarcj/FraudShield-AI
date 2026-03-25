"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Moon, Palette, Save, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/authContext";

const STORAGE_KEY = "fraudshield_settings";

const DEFAULT_SETTINGS = {
  theme: "dark",
  notifications: true,
  refreshSeconds: 10,
  compactTables: false
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?mode=signin");
    }
  }, [loading, user, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore corrupted local settings
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.colorScheme = settings.theme === "light" ? "light" : "dark";
  }, [settings.theme]);

  const refreshLabel = useMemo(() => `${Math.max(3, Number(settings.refreshSeconds || 10))}s`, [settings.refreshSeconds]);

  const saveSettings = () => {
    const payload = {
      ...settings,
      refreshSeconds: Math.max(3, Number(settings.refreshSeconds || 10))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    toast.success("Settings saved.");
  };

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <section className="space-y-6 py-2">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Preferences</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-2 text-sm text-slate-300">Control UI behavior, theme, and notification preferences.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Palette className="h-4 w-4 text-cyan-300" />Theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={settings.theme === "dark" ? "default" : "outline"}
                onClick={() => setSettings((prev) => ({ ...prev, theme: "dark" }))}
              >
                <Moon className="mr-2 h-4 w-4" />Dark
              </Button>
              <Button
                type="button"
                variant={settings.theme === "light" ? "default" : "outline"}
                onClick={() => setSettings((prev) => ({ ...prev, theme: "light" }))}
              >
                <Sun className="mr-2 h-4 w-4" />Light
              </Button>
            </div>
            <p className="text-xs text-slate-400">Theme is applied globally and persisted in local storage.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-4 w-4 text-cyan-300" />Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              Enable alert toasts
              <input
                type="checkbox"
                checked={Boolean(settings.notifications)}
                onChange={(event) => setSettings((prev) => ({ ...prev, notifications: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              Compact data tables
              <input
                type="checkbox"
                checked={Boolean(settings.compactTables)}
                onChange={(event) => setSettings((prev) => ({ ...prev, compactTables: event.target.checked }))}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monitoring Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm text-slate-300" htmlFor="refresh-seconds">Default auto-refresh interval (seconds)</label>
          <Input
            id="refresh-seconds"
            type="number"
            min={3}
            value={settings.refreshSeconds}
            onChange={(event) => setSettings((prev) => ({ ...prev, refreshSeconds: Number(event.target.value) }))}
          />
          <p className="text-xs text-slate-400">Current interval: {refreshLabel}</p>
        </CardContent>
      </Card>

      <Button onClick={saveSettings}>
        <Save className="mr-2 h-4 w-4" />Save Settings
      </Button>

      <style jsx global>{`
        html[data-theme="light"] body {
          background: radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 35%), #eef4ff;
          color: #0f172a;
        }
        html[data-theme="light"] .glass-panel,
        html[data-theme="light"] [class*="bg-slate-900"],
        html[data-theme="light"] [class*="bg-slate-950"] {
          background-color: rgba(255, 255, 255, 0.7) !important;
          border-color: rgba(148, 163, 184, 0.35) !important;
          color: #0f172a;
        }
        html[data-theme="light"] .text-white {
          color: #0f172a !important;
        }
        html[data-theme="light"] .text-slate-300,
        html[data-theme="light"] .text-slate-200,
        html[data-theme="light"] .text-slate-100 {
          color: #334155 !important;
        }
      `}</style>
    </section>
  );
}
