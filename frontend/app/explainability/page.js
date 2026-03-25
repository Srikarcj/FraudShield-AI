"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Brain, Database, Layers, Lock, Radar, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/authContext";

const HIGHLIGHTS = [
  {
    title: "Hybrid Intelligence Stack",
    description: "We orchestrate classical ML, deep learning, and time-series models into a single fraud scoring brain.",
    icon: Layers
  },
  {
    title: "Explainability Layer",
    description: "Each decision includes top feature signals and model contributions to keep risk teams in control.",
    icon: Brain
  },
  {
    title: "Real-Time Scoring",
    description: "The Flask API delivers low-latency predictions from real transaction data, not simulations.",
    icon: Radar
  },
  {
    title: "Secure Workflow",
    description: "Supabase-backed identity and history storage keeps fraud operations auditable and secure.",
    icon: Lock
  }
];

const PIPELINE = [
  {
    title: "Data Intake",
    detail: "CSV transaction data is validated and normalized with V1-V28 + Amount feature structure.",
    icon: Database
  },
  {
    title: "Feature Engineering",
    detail: "Scaling, log transforms, and time-series context align incoming rows with model expectations.",
    icon: Workflow
  },
  {
    title: "Hybrid Scoring",
    detail: "RF, LR, XGB, ARIMA, LSTM, CNN, and Transformer outputs feed a stacking meta-model.",
    icon: Layers
  },
  {
    title: "Explain + Deliver",
    detail: "Predictions ship with confidence, risk score, and a human-readable explanation summary.",
    icon: Sparkles
  }
];

const DELIVERABLES = [
  {
    title: "Dashboard Command Center",
    text: "Live predictions, dataset uploads, and history monitoring for daily fraud operations.",
    icon: ShieldCheck
  },
  {
    title: "Results + Reports",
    text: "Trend analytics and CSV exports built entirely from stored real transaction outcomes.",
    icon: Radar
  },
  {
    title: "Explainability Studio",
    text: "Clear narrative of the model stack and how each prediction is formed.",
    icon: Brain
  }
];

export default function ExplainabilityPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?mode=signin");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <section className="space-y-8 py-2">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8"
      >
        <div className="absolute inset-0 opacity-70">
          <div className="absolute -left-20 -top-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" />
        </div>

        <div className="relative max-w-3xl">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Project Explain</p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">What We Built With FraudShield AI</h1>
          <p className="mt-3 text-sm text-slate-300">
            This page is the story of the product: how real transaction data flows through our hybrid model stack, how
            predictions are explained, and how the platform supports fraud teams from detection to reporting.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => router.push("/dashboard")}>Open Live Dashboard</Button>
            <Button variant="outline" onClick={() => router.push("/reports")}>View Reports</Button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {HIGHLIGHTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeInOut" }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
            >
              <div className="mb-3 inline-flex rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-2">
                <Icon className="h-5 w-5 text-emerald-200" />
              </div>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{item.description}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Pipeline</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">How Data Becomes an Explainable Decision</h2>
          </div>
          <div className="hidden rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 md:inline-flex">
            Real data only
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {PIPELINE.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.35, delay: idx * 0.06, ease: "easeInOut" }}
                className="relative rounded-2xl border border-white/10 bg-slate-900/40 p-5"
              >
                <p className="text-xs uppercase tracking-widest text-slate-400">Step {idx + 1}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="inline-flex rounded-lg border border-cyan-300/30 bg-cyan-400/10 p-2">
                    <Icon className="h-4 w-4 text-cyan-200" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-300">{step.detail}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {DELIVERABLES.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.35, delay: idx * 0.06, ease: "easeInOut" }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <Icon className="h-5 w-5 text-emerald-300" />
              </div>
              <p className="mt-3 text-sm text-slate-300">{item.text}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Explainability Promise</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Every Prediction Has a Story</h2>
            <p className="mt-3 text-sm text-slate-300">
              We surface the strongest feature signals, show which models influenced the verdict, and attach risk scores so
              analysts can explain decisions with confidence.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            Built for clarity + auditability
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Decision</p>
            <p className="mt-2 text-sm text-slate-300">Fraud / Safe classification with confidence and threshold alignment.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Drivers</p>
            <p className="mt-2 text-sm text-slate-300">Top signal features and model contribution highlights for transparency.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Action</p>
            <p className="mt-2 text-sm text-slate-300">Risk banding that guides the next operational step for analysts.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
