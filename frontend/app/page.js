"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Brain, Database, Lock, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import HeroAnimation from "@/components/HeroAnimation";
import LiveStats from "@/components/LiveStats";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/authContext";

const FLASK_BASE_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://127.0.0.1:5000";

const TRUST_BADGES = ["Hybrid AI Models", "Real-time Analysis", "Explainable AI"];

const FEATURES = [
  {
    title: "Explainable AI",
    description: "Understand why each transaction was flagged with feature-level reasoning.",
    icon: Brain
  },
  {
    title: "Hybrid Models",
    description: "LSTM + CNN + Transformer + ARIMA combined through stacking logic.",
    icon: Workflow
  },
  {
    title: "Real-time Detection",
    description: "Low-latency API scoring for manual and row-based transaction checks.",
    icon: Activity
  },
  {
    title: "Secure Platform",
    description: "Authentication and storage managed through Supabase-backed workflows.",
    icon: ShieldCheck
  }
];

const STEPS = [
  "Input Transaction",
  "AI Model Processing",
  "Fraud Detection",
  "Insights Output"
];

const MODEL_STACK = [
  { name: "CNN" },
  { name: "LSTM" },
  { name: "Transformer" },
  { name: "ARIMA" }
];

const SECURITY_ITEMS = [
  { title: "Authentication", text: "Secure sign-in and account control.", icon: Lock },
  { title: "Storage", text: "Protected Supabase persistence for prediction history.", icon: Database },
  { title: "Encryption", text: "Data handling designed for fintech-grade confidentiality.", icon: ShieldCheck }
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const [modelScores, setModelScores] = useState({});
  const [bestModel, setBestModel] = useState("Hybrid Stacking Model");

  const ctaHref = useMemo(() => {
    if (loading) return "/dashboard";
    return user ? "/dashboard" : "/auth?mode=signin";
  }, [loading, user]);

  useEffect(() => {
    let active = true;

    const loadModelScores = async () => {
      try {
        const response = await fetch(`${FLASK_BASE_URL}/api/model_comparison`, { method: "GET" });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) return;

        const rows = Array.isArray(payload.models) ? payload.models : [];
        const nextScores = {};

        for (const model of MODEL_STACK) {
          const match = rows.find((item) => String(item.name).toLowerCase() === model.name.toLowerCase());
          const f1 = Number(match?.f1_score);
          if (Number.isFinite(f1)) {
            nextScores[model.name] = Math.max(0, Math.min(100, Math.round(f1 * 100)));
          }
        }

        if (!active) return;
        setModelScores(nextScores);
        if (payload.best_model) {
          setBestModel(String(payload.best_model));
        }
      } catch {
        // keep UI stable if backend comparison endpoint is unavailable
      }
    };

    loadModelScores();
    const timer = setInterval(loadModelScores, 60000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-16 py-8 md:space-y-20 md:py-12">
      <section className="glass-panel rounded-2xl p-6 md:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <p className="mb-4 inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Fintech Risk Intelligence
            </p>

            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white md:text-5xl">
              Real-time credit card
              <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent"> fraud detection</span>
              {" "}with explainable
              <span className="bg-gradient-to-r from-blue-300 to-emerald-300 bg-clip-text text-transparent"> AI insights</span>
            </h1>

            <p className="mt-4 max-w-2xl text-slate-300">
              FraudShield AI combines hybrid model intelligence, explainability, and real-time scoring to protect high-volume payment streams.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {TRUST_BADGES.map((badge, idx) => (
                <motion.span
                  key={badge}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.08, ease: "easeInOut" }}
                  className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200"
                >
                  {badge}
                </motion.span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2, ease: "easeInOut" }}>
                <Link href={ctaHref}>
                  <Button
                    size="lg"
                    className="shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_10px_25px_rgba(16,185,129,0.28)]"
                  >
                    Go to Dashboard
                  </Button>
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2, ease: "easeInOut" }}>
                <Link href="/results">
                  <Button
                    variant="outline"
                    size="lg"
                    className="shadow-[0_0_0_1px_rgba(14,165,233,0.25),0_10px_25px_rgba(14,165,233,0.18)]"
                  >
                    View Results
                  </Button>
                </Link>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeInOut" }}
          >
            <HeroAnimation />
          </motion.div>
        </div>
      </section>

      <LiveStats />

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-white md:text-3xl">Core Capabilities</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl hover:border-emerald-300/40"
              >
                <div className="mb-3 inline-flex rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-2">
                  <Icon className="h-5 w-5 text-emerald-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-white md:text-3xl">How It Works</h2>
        <div className="grid gap-4 lg:grid-cols-4">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: idx * 0.08, ease: "easeInOut" }}
              className="relative rounded-2xl border border-white/10 bg-slate-900/45 p-5"
            >
              <p className="text-xs uppercase tracking-widest text-slate-400">Step {idx + 1}</p>
              <p className="mt-2 text-lg font-medium text-white">{step}</p>
              {idx < STEPS.length - 1 ? (
                <Sparkles className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-cyan-300 lg:block" />
              ) : null}
            </motion.div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">Model Intelligence</h2>
          <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            {bestModel}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODEL_STACK.map((model) => (
            <div key={model.name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">{model.name}</p>
              <p className="mt-1 text-lg font-semibold text-white">Signal Strength</p>
              <div className="mt-4 h-2.5 rounded-full bg-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Number(modelScores[model.name] || 0)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {Number.isFinite(modelScores[model.name])
                  ? `${modelScores[model.name]}% confidence blend`
                  : "Awaiting latest evaluation"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 md:p-8">
        <h2 className="text-2xl font-semibold text-white md:text-3xl">Security First</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {SECURITY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 inline-flex rounded-lg border border-cyan-300/30 bg-cyan-400/10 p-2">
                  <Icon className="h-4 w-4 text-cyan-300" />
                </div>
                <p className="font-medium text-white">{item.title}</p>
                <p className="mt-1 text-sm text-slate-300">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6 text-center md:p-10">
        <h2 className="text-3xl font-semibold text-white">Start detecting fraud in seconds</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-300">
          Launch real-time fraud analysis workflows with explainable outputs and model-level visibility.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2, ease: "easeInOut" }}>
            <Link href={ctaHref}>
              <Button size="lg" className="shadow-[0_12px_30px_rgba(16,185,129,0.28)]">Go to Dashboard</Button>
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2, ease: "easeInOut" }}>
            <Link href="/results">
              <Button variant="outline" size="lg">Try Demo</Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
