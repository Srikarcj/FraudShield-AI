"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Activity, ShieldCheck, Target, Trophy } from "lucide-react";

const FLASK_BASE_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://127.0.0.1:5000";
const REFRESH_MS = 10000;

function AnimatedNumber({ value, suffix = "", decimals = 0 }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => {
    const factor = 10 ** decimals;
    return (Math.round(latest * factor) / factor).toFixed(decimals);
  });

  useEffect(() => {
    const controls = animate(motionValue, Number(value || 0), {
      duration: 0.9,
      ease: "easeInOut"
    });
    return () => controls.stop();
  }, [motionValue, value]);

  return (
    <span>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

export default function LiveStats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!lastUpdatedAt) return;
      setElapsedSec(Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdatedAt]);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      try {
        const response = await fetch(`${FLASK_BASE_URL}/api/home_metrics`, { method: "GET" });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || "Metrics unavailable");
        }
        if (!active) return;
        setStats(payload);
        setError("");
        setLastUpdatedAt(Date.now());
        setElapsedSec(0);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Metrics unavailable");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const cards = useMemo(() => {
    return [
      {
        label: "Total Transactions",
        icon: Activity,
        kind: "number",
        value: Number(stats?.total_transactions || 0),
        suffix: "",
        decimals: 0
      },
      {
        label: "Best Model",
        icon: Trophy,
        kind: "text",
        text: String(stats?.best_model || "Unavailable")
      },
      {
        label: "Best F1 Score",
        icon: Target,
        kind: "number",
        value: Number(stats?.best_f1 || 0),
        suffix: "",
        decimals: 4
      },
      {
        label: "Hybrid Engine",
        icon: ShieldCheck,
        kind: "text",
        text: stats?.hybrid_ready ? "Ready" : "Not Ready"
      }
    ];
  }, [stats]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          Live
        </div>
        <p className="text-xs text-slate-400">Last updated: {lastUpdatedAt ? `${elapsedSec}s ago` : "--"}</p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: idx * 0.08, ease: "easeInOut" }}
              className="glass-panel rounded-2xl p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-slate-400">{card.label}</p>
                <Icon className="h-4 w-4 text-emerald-300" />
              </div>

              <p className="text-3xl font-semibold text-white">
                {loading && !stats ? (
                  "--"
                ) : card.kind === "number" ? (
                  <AnimatedNumber value={card.value} suffix={card.suffix} decimals={card.decimals} />
                ) : (
                  card.text
                )}
              </p>

              {card.label === "Best F1 Score" ? (
                <p className="mt-2 text-xs text-slate-400">from evaluation test split</p>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
