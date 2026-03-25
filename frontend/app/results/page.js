"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChartCard from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { evaluateModel, modelComparison } from "@/lib/api";
import { fetchPredictionHistory, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PIE_COLORS = ["#22c55e", "#ef4444"];

export default function ResultsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [latestResult, setLatestResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [modelMetrics, setModelMetrics] = useState([]);
  const [bestModel, setBestModel] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("latestPrediction");
    if (raw) {
      try {
        setLatestResult(JSON.parse(raw));
      } catch {
        localStorage.removeItem("latestPrediction");
      }
    }
  }, []);

  const analytics = useMemo(() => {
    const total = history.length;
    const fraudCount = history.filter((item) => Number(item.prediction) === 1).length;
    const safeCount = total - fraudCount;
    const fraudRate = total ? (fraudCount / total) * 100 : 0;

    const byDay = {};
    history.forEach((item) => {
      const dayKey = new Date(item.created_at).toISOString().slice(0, 10);
      if (!byDay[dayKey]) byDay[dayKey] = { date: dayKey, fraud: 0, safe: 0 };
      if (Number(item.prediction) === 1) byDay[dayKey].fraud += 1;
      else byDay[dayKey].safe += 1;
    });

    const trendData = Object.values(byDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((item) => ({ ...item, total: item.fraud + item.safe }));

    return {
      total,
      fraudCount,
      safeCount,
      fraudRate,
      pieData: [
        { name: "Safe", value: safeCount },
        { name: "Fraud", value: fraudCount }
      ],
      trendData
    };
  }, [history]);

  const loadPageData = async () => {
    setLoading(true);
    setError("");
    try {
      const [evalPayload, comparisonPayload] = await Promise.all([evaluateModel(), modelComparison()]);
      setMetrics(evalPayload);
      setModelMetrics(Array.isArray(comparisonPayload.models) ? comparisonPayload.models : []);
      setBestModel(String(comparisonPayload.best_model || ""));

      if (user && isSupabaseConfigured) {
        const { data } = await fetchPredictionHistory(user, 200);
        setHistory(data || []);
      }
    } catch (err) {
      setError(err?.message || "Unable to load evaluation metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth?mode=signin");
      return;
    }
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  if (authLoading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6 lg:flex-row">
      <Sidebar />

      <div className="min-w-0 flex-1 space-y-6">
        <div className="glass-panel rounded-xl p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Results & Evaluation</h1>
              <p className="mt-1 text-xs text-emerald-300">Real data: Flask evaluation endpoints + Supabase prediction history.</p>
            </div>
            <Button variant="outline" onClick={loadPageData} disabled={loading}>
              {loading ? <Spinner /> : "Refresh"}
            </Button>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Spinner /> Loading evaluation metrics...
            </div>
          ) : metrics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricBox label="Accuracy" value={metrics.accuracy} />
              <MetricBox label="Precision" value={metrics.precision} />
              <MetricBox label="Recall" value={metrics.recall} />
              <MetricBox label="F1 Score" value={metrics.f1_score} />
            </div>
          ) : null}

          {metrics?.confusion_matrix ? <ConfusionMatrix matrix={metrics.confusion_matrix} /> : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Model Comparison Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">Best Model: <span className="font-semibold text-white">{bestModel || "N/A"}</span></p>

            {modelMetrics.length > 0 ? (
              <div className="h-72 rounded-lg border border-white/10 bg-slate-900/40 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" domain={[0, 1]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="f1_score" fill="#10b981" name="F1" />
                    <Bar dataKey="accuracy" fill="#60a5fa" name="Accuracy" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-300">No model comparison data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Analytics Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricBox label="Total Transactions" value={analytics.total} raw />
              <MetricBox label="Fraud Count" value={analytics.fraudCount} raw />
              <MetricBox label="Safe Count" value={analytics.safeCount} raw />
              <MetricBox label="Fraud Rate" value={analytics.fraudRate / 100} percent />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64 rounded-lg border border-white/10 bg-slate-900/40 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.pieData} dataKey="value" nameKey="name" outerRadius={90}>
                      {analytics.pieData.map((entry, idx) => (
                        <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64 rounded-lg border border-white/10 bg-slate-900/40 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="fraud" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="safe" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <ChartCard result={latestResult} />

        <Card>
          <CardHeader>
            <CardTitle>Recent Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-slate-300">No history records yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.slice(0, 20).map((item) => (
                  <li key={item.id} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                    <span className="font-medium">{new Date(item.created_at).toLocaleString()}</span>
                    {" | "}
                    <span className="capitalize">{item.input_type}</span>
                    {" | "}
                    <span>{Number(item.prediction) === 1 ? "Fraud" : "Safe"}</span>
                    {" | "}
                    <span>{Number(item.confidence).toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricBox({ label, value, raw = false, percent = false }) {
  let rendered;
  if (raw) {
    rendered = Number(value || 0).toString();
  } else if (percent) {
    rendered = `${(Number(value || 0) * 100).toFixed(2)}%`;
  } else {
    rendered = Number(value || 0).toFixed(4);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{rendered}</p>
    </div>
  );
}

function ConfusionMatrix({ matrix }) {
  const tn = matrix?.[0]?.[0] ?? 0;
  const fp = matrix?.[0]?.[1] ?? 0;
  const fn = matrix?.[1]?.[0] ?? 0;
  const tp = matrix?.[1]?.[1] ?? 0;

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="min-w-full md:min-w-[640px] border-collapse text-xs text-slate-200 sm:text-sm">
        <thead>
          <tr>
            <th className="border border-white/10 bg-slate-900/60 px-3 py-2">Actual \\ Predicted</th>
            <th className="border border-white/10 bg-slate-900/60 px-3 py-2">Negative (0)</th>
            <th className="border border-white/10 bg-slate-900/60 px-3 py-2">Positive (1)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-white/10 bg-slate-900/60 px-3 py-2">Actual Negative (0)</td>
            <td className="border border-white/10 px-3 py-2">{tn} (TN)</td>
            <td className="border border-white/10 px-3 py-2">{fp} (FP)</td>
          </tr>
          <tr>
            <td className="border border-white/10 bg-slate-900/60 px-3 py-2">Actual Positive (1)</td>
            <td className="border border-white/10 px-3 py-2">{fn} (FN)</td>
            <td className="border border-white/10 px-3 py-2">{tp} (TP)</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
