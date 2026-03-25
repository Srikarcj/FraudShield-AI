"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BellRing, ShieldAlert, TriangleAlert } from "lucide-react";
import AlertCard from "@/components/AlertCard";
import StatCard from "@/components/StatCard";
import TableComponent from "@/components/TableComponent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/authContext";
import { fetchPredictionHistory, isSupabaseConfigured } from "@/lib/supabaseClient";

const REFRESH_MS = 8000;

function toRiskScore(record) {
  const confidence = Number(record?.confidence || 0);
  return Math.max(0, Math.min(100, confidence));
}

export default function AlertsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [busy, setBusy] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [ageSeconds, setAgeSeconds] = useState(0);

  const loadAlerts = async (activeUser = user) => {
    if (!activeUser) return;
    setBusy(true);
    try {
      const { data } = await fetchPredictionHistory(activeUser, 300);
      const rows = Array.isArray(data) ? data : [];
      const fraudRows = rows
        .filter((item) => Number(item.prediction) === 1)
        .map((item) => ({ ...item, risk_score: toRiskScore(item) }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAlerts(fraudRows);
      setLastUpdated(Date.now());
      setAgeSeconds(0);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?mode=signin");
      return;
    }

    loadAlerts(user);
    const timer = setInterval(() => loadAlerts(user), REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  useEffect(() => {
    if (!lastUpdated) return;
    const timer = setInterval(() => {
      setAgeSeconds(Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const metrics = useMemo(() => {
    const total = alerts.length;
    const highRisk = alerts.filter((item) => Number(item.risk_score) >= 85).length;
    const avgRisk = total ? alerts.reduce((acc, item) => acc + Number(item.risk_score || 0), 0) / total : 0;
    return { total, highRisk, avgRisk };
  }, [alerts]);

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <section className="space-y-6 py-2">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeInOut" }}>
        <div className="glass-panel rounded-2xl border-red-400/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Risk Monitoring</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">Fraud Alerts</h1>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="gap-1.5">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-200" />
                Live
              </Badge>
              <Button variant="outline" onClick={() => loadAlerts()} disabled={busy}>
                {busy ? <Spinner /> : "Refresh"}
              </Button>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-300">
            Last updated: {lastUpdated ? `${ageSeconds}s ago` : "never"}
            {isSupabaseConfigured ? "" : " (Supabase not configured)"}
          </p>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Fraud Alerts" value={metrics.total} subtitle="Fraud-only transactions" icon={ShieldAlert} tone="danger" />
        <StatCard title="High Risk" value={metrics.highRisk} subtitle="Risk score >= 85" icon={TriangleAlert} tone="danger" />
        <StatCard title="Average Risk" value={`${metrics.avgRisk.toFixed(1)}%`} subtitle="Across current alert stream" icon={BellRing} tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {alerts.slice(0, 6).map((item) => (
          <AlertCard
            key={item.id}
            title={Number(item.risk_score) >= 85 ? "Critical Fraud Signal" : "Fraud Signal"}
            riskScore={item.risk_score}
            confidence={item.confidence}
            modelName={item.model_used}
            timestamp={item.created_at}
            level="fraud"
          />
        ))}
      </div>

      <div className="glass-panel rounded-xl border-red-400/20 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Alert Feed</h2>
        <TableComponent
          rows={alerts}
          emptyMessage="No fraud alerts in history yet."
          columns={[
            { key: "created_at", label: "Timestamp", render: (value) => new Date(value).toLocaleString() },
            { key: "input_type", label: "Type", render: (value) => String(value || "manual") },
            { key: "risk_score", label: "Risk Score", render: (value) => `${Number(value || 0).toFixed(0)}/100` },
            { key: "confidence", label: "Confidence", render: (value) => `${Number(value || 0).toFixed(2)}%` },
            { key: "model_used", label: "Model" }
          ]}
        />
      </div>
    </section>
  );
}
