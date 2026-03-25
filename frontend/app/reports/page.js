"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, Download, FileClock, RefreshCw } from "lucide-react";
import ChartComponent from "@/components/ChartComponent";
import StatCard from "@/components/StatCard";
import TableComponent from "@/components/TableComponent";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/authContext";
import { fetchPredictionHistory } from "@/lib/supabaseClient";

function periodKey(dateObj, mode) {
  const d = new Date(dateObj);
  if (mode === "weekly") {
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
  }
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [busy, setBusy] = useState(true);
  const [mode, setMode] = useState("daily");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [history, setHistory] = useState([]);

  const loadData = async (activeUser = user) => {
    if (!activeUser) return;
    setBusy(true);
    try {
      const { data } = await fetchPredictionHistory(activeUser, 500);
      setHistory(Array.isArray(data) ? data : []);
      setGeneratedAt(Date.now());
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

    loadData(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  const { rows, totals, trend } = useMemo(() => {
    const grouped = new Map();

    for (const item of history) {
      const key = periodKey(item.created_at, mode);
      const prev = grouped.get(key) || { period: key, total: 0, fraud: 0, safe: 0, avg_confidence_sum: 0 };
      prev.total += 1;
      if (Number(item.prediction) === 1) prev.fraud += 1;
      else prev.safe += 1;
      prev.avg_confidence_sum += Number(item.confidence || 0);
      grouped.set(key, prev);
    }

    const aggregateRows = Array.from(grouped.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((item) => ({
        ...item,
        avg_confidence: item.total ? item.avg_confidence_sum / item.total : 0,
        fraud_rate: item.total ? (item.fraud / item.total) * 100 : 0
      }));

    const total = aggregateRows.reduce((sum, row) => sum + row.total, 0);
    const fraud = aggregateRows.reduce((sum, row) => sum + row.fraud, 0);
    const safe = aggregateRows.reduce((sum, row) => sum + row.safe, 0);
    const avgConfidence = total
      ? aggregateRows.reduce((sum, row) => sum + row.avg_confidence * row.total, 0) / total
      : 0;

    const trendRows = aggregateRows.map((row) => ({
      period: row.period,
      fraud: row.fraud,
      safe: row.safe,
      fraud_rate: Number(row.fraud_rate.toFixed(2))
    }));

    return {
      rows: aggregateRows,
      totals: {
        total,
        fraud,
        safe,
        avgConfidence,
        fraudRate: total ? (fraud / total) * 100 : 0
      },
      trend: trendRows
    };
  }, [history, mode]);

  const insights = useMemo(() => {
    if (!rows.length) {
      return {
        peakPeriod: "No data",
        peakFraud: 0,
        peakRate: 0,
        peakConfidence: 0
      };
    }

    const peakFraud = rows.reduce((max, row) => (row.fraud > max.fraud ? row : max), rows[0]);
    const peakRate = rows.reduce((max, row) => (row.fraud_rate > max.fraud_rate ? row : max), rows[0]);
    const peakConfidence = rows.reduce((max, row) => (row.avg_confidence > max.avg_confidence ? row : max), rows[0]);

    return {
      peakPeriod: peakFraud.period,
      peakFraud: peakFraud.fraud,
      peakRate: peakRate.fraud_rate,
      peakConfidence: peakConfidence.avg_confidence
    };
  }, [rows]);

  const downloadCsv = () => {
    const headers = ["period", "total", "fraud", "safe", "fraud_rate", "avg_confidence"];
    const csvRows = rows.map((row) => [
      row.period,
      row.total,
      row.fraud,
      row.safe,
      row.fraud_rate.toFixed(2),
      row.avg_confidence.toFixed(2)
    ]);
    const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fraud_report_${mode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6"
      >
        <div className="absolute inset-0 opacity-70">
          <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Reporting</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Fraud Reports</h1>
            <p className="mt-2 text-sm text-slate-300">Generate daily or weekly fraud summaries from real prediction history.</p>
            <p className="mt-1 text-xs text-emerald-300">Real data source: Supabase predictions history.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant={mode === "daily" ? "default" : "outline"} onClick={() => setMode("daily")}>Daily</Button>
            <Button variant={mode === "weekly" ? "default" : "outline"} onClick={() => setMode("weekly")}>Weekly</Button>
            <Button variant="outline" onClick={() => loadData()} disabled={busy}>
              {busy ? <Spinner /> : <><RefreshCw className="mr-2 h-4 w-4" />Refresh</>}
            </Button>
            <Button onClick={downloadCsv} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" />Download CSV
            </Button>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Mode: {mode === "daily" ? "Daily" : "Weekly"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {generatedAt ? `Last generated ${new Date(generatedAt).toLocaleString()}` : "No report generated yet"}
          </span>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Transactions" value={totals.total} subtitle={`${mode} report`} tone="default" />
        <StatCard title="Fraud" value={totals.fraud} subtitle="Flagged records" tone="danger" />
        <StatCard title="Safe" value={totals.safe} subtitle="Non-fraud records" tone="success" />
        <StatCard title="Fraud Rate" value={`${totals.fraudRate.toFixed(2)}%`} subtitle="Across selected period" tone="default" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-widest text-slate-400">Peak Fraud Volume</p>
          <p className="mt-2 text-2xl font-semibold text-white">{insights.peakPeriod}</p>
          <p className="mt-1 text-sm text-slate-300">{insights.peakFraud} flagged transactions</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-widest text-slate-400">Highest Fraud Rate</p>
          <p className="mt-2 text-2xl font-semibold text-white">{rows.length ? `${insights.peakRate.toFixed(2)}%` : "--"}</p>
          <p className="mt-1 text-sm text-slate-300">Across the selected period</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-widest text-slate-400">Top Confidence Window</p>
          <p className="mt-2 text-2xl font-semibold text-white">{rows.length ? `${insights.peakConfidence.toFixed(2)}%` : "--"}</p>
          <p className="mt-1 text-sm text-slate-300">Highest average prediction confidence</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartComponent
          title="Fraud vs Safe Over Time"
          type="line"
          data={trend}
          xKey="period"
          lines={[
            { key: "fraud", label: "Fraud", color: "#ef4444" },
            { key: "safe", label: "Safe", color: "#22c55e" }
          ]}
        />

        <ChartComponent
          title="Fraud Rate Trend"
          type="bar"
          data={trend}
          xKey="period"
          yKey="fraud_rate"
        />
      </div>

      <div className="glass-panel rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">Summary Table</h2>
          <span className="inline-flex items-center gap-2 text-xs text-slate-400">
            <FileClock className="h-4 w-4 text-cyan-300" />
            Mode: {mode}
          </span>
        </div>
        <TableComponent
          rows={rows}
          emptyMessage="No report rows available yet."
          columns={[
            { key: "period", label: mode === "daily" ? "Date" : "Week Start" },
            { key: "total", label: "Total" },
            { key: "fraud", label: "Fraud" },
            { key: "safe", label: "Safe" },
            { key: "fraud_rate", label: "Fraud Rate", render: (value) => `${Number(value || 0).toFixed(2)}%` },
            { key: "avg_confidence", label: "Avg Confidence", render: (value) => `${Number(value || 0).toFixed(2)}%` }
          ]}
        />
      </div>

      <div className="glass-panel rounded-xl p-4">
        <p className="inline-flex items-center gap-2 text-sm text-slate-300">
          <ArrowUpRight className="h-4 w-4 text-emerald-300" />Reports are generated from stored prediction history only.
        </p>
      </div>
    </section>
  );
}
