"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Activity, Database, ShieldCheck, Sparkles } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import InputCard from "@/components/InputCard";
import ResultCard from "@/components/ResultCard";
import ChartCard from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiStatus, parseCsvRowText, predict, predictRow, randomTest, uploadCsv } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { ensureUserRecord, fetchPredictionHistory, insertPredictionHistory, isSupabaseConfigured } from "@/lib/supabaseClient";

const INITIAL_BUSY = {
  manual: false,
  row: false,
  random: false,
  upload: false,
  history: false
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [rowId, setRowId] = useState(0);
  const [csvRowText, setCsvRowText] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [busy, setBusy] = useState(INITIAL_BUSY);
  const [latestResult, setLatestResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [apiStatus, setApiStatus] = useState({ connected: false, message: "Checking API..." });

  const [fraudOnly, setFraudOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (fraudOnly && Number(item.prediction) !== 1) return false;

      const createdAt = new Date(item.created_at);
      if (startDate) {
        const from = new Date(`${startDate}T00:00:00`);
        if (createdAt < from) return false;
      }
      if (endDate) {
        const to = new Date(`${endDate}T23:59:59`);
        if (createdAt > to) return false;
      }
      return true;
    });
  }, [history, fraudOnly, startDate, endDate]);

  const historyEmptyMessage = useMemo(() => {
    if (!isSupabaseConfigured) {
      return "Supabase is not configured. Add env vars to enable history.";
    }
    if (fraudOnly || startDate || endDate) {
      return "No history matches the selected filters.";
    }
    return "No prediction history yet.";
  }, [fraudOnly, startDate, endDate]);

  const historyStats = useMemo(() => {
    const total = history.length;
    const fraud = history.filter((item) => Number(item.prediction) === 1).length;
    const safe = Math.max(total - fraud, 0);
    const avgConfidence = total
      ? history.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / total
      : 0;
    const fraudRate = total ? (fraud / total) * 100 : 0;

    return { total, fraud, safe, avgConfidence, fraudRate };
  }, [history]);

  const latestSummary = useMemo(() => {
    if (!latestResult) {
      return {
        decision: "No recent run",
        confidence: null,
        riskScore: null,
        model: "-"
      };
    }

    return {
      decision: Number(latestResult.prediction) === 1 ? "Fraud" : "Safe",
      confidence: Number(latestResult.confidence || 0),
      riskScore: Number(latestResult.risk_score || 0),
      model: latestResult.model_used || "Hybrid"
    };
  }, [latestResult]);

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

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const payload = await getApiStatus();
        setApiStatus({ connected: true, message: payload.model_message || "API connected" });
      } catch {
        setApiStatus({ connected: false, message: "Flask API disconnected" });
      }
    };

    checkStatus();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?mode=signin");
      return;
    }

    const syncUserAndHistory = async () => {
      try {
        await ensureUserRecord(user);
        await loadHistory(user);
      } catch {
        // no-op: dashboard remains usable even without history persistence
      }
    };

    syncUserAndHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const setBusyFlag = (key, value) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  };

  const saveLatestResult = (payload) => {
    setLatestResult(payload);
    localStorage.setItem("latestPrediction", JSON.stringify(payload));
  };

  const loadHistory = async (activeUser = user) => {
    if (!activeUser) return;
    setBusyFlag("history", true);
    try {
      const { data, error } = await fetchPredictionHistory(activeUser, 100);
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      toast.error(error?.message || "Failed to load history.");
    } finally {
      setBusyFlag("history", false);
    }
  };

  const persistPrediction = async (payload) => {
    if (!user || !isSupabaseConfigured) return;
    const { error } = await insertPredictionHistory(user, payload);
    if (error) {
      toast.error("Prediction saved locally, but Supabase insert failed.");
      return;
    }
    await loadHistory(user);
  };

  const runPredictionAction = async (type, action) => {
    setBusyFlag(type, true);
    try {
      const payload = await action();
      saveLatestResult(payload);
      await persistPrediction(payload);

      const riskScore = Number(payload?.risk_score || 0);
      if (Number(payload?.prediction) === 1 || riskScore >= 70) {
        toast.error("High Risk Transaction Detected!");
      } else {
        toast.success("Prediction completed.");
      }
    } catch (error) {
      toast.error(error?.message || "Prediction failed.");
    } finally {
      setBusyFlag(type, false);
    }
  };

  const handleRowPrediction = async (event) => {
    event.preventDefault();
    await runPredictionAction("row", () => predictRow(Number(rowId)));
  };

  const handleRandomPrediction = async () => {
    await runPredictionAction("random", () => randomTest());
  };

  const handleManualCsvPrediction = async (event) => {
    event.preventDefault();
    await runPredictionAction("manual", async () => {
      const parsed = parseCsvRowText(csvRowText);
      return predict({ values: parsed.values, amount: parsed.amount });
    });
  };

  const handleCsvUpload = async (event) => {
    event.preventDefault();
    if (!csvFile) {
      toast.error("Please choose a CSV file first.");
      return;
    }

    setBusyFlag("upload", true);
    try {
      const response = await uploadCsv(csvFile);
      toast.success(`${response.message} Rows: ${response.rows}`);
    } catch (error) {
      toast.error(error?.message || "CSV upload failed.");
    } finally {
      setBusyFlag("upload", false);
    }
  };

  const navigateToResults = () => {
    router.push("/results");
  };

  if (loading || !user) {
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
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.35)]"
        >
          <div className="absolute inset-0 opacity-70">
            <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Live Command Center</p>
              <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Fraud Detection Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                All insights below are powered by real transaction data, with model outputs streamed from the live Flask API.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200">
              <span className={`h-2.5 w-2.5 rounded-full ${apiStatus.connected ? "bg-emerald-400" : "bg-red-400"}`} />
              <span>API {apiStatus.connected ? "Connected" : "Disconnected"}</span>
              <span className="text-slate-400">{apiStatus.message}</span>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Latest Decision</span>
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{latestSummary.decision}</p>
              <p className="mt-1 text-xs text-slate-400">Model: {latestSummary.model}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Confidence</span>
                <Activity className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">
                {latestSummary.confidence === null ? "--" : `${latestSummary.confidence.toFixed(2)}%`}
              </p>
              <p className="mt-1 text-xs text-slate-400">Latest prediction output</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Risk Score</span>
                <Sparkles className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">
                {latestSummary.riskScore === null ? "--" : `${latestSummary.riskScore}/100`}
              </p>
              <p className="mt-1 text-xs text-slate-400">Live risk banding</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Total Predictions</span>
                <Database className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{historyStats.total}</p>
              <p className="mt-1 text-xs text-slate-400">Fraud rate: {historyStats.total ? `${historyStats.fraudRate.toFixed(2)}%` : "--"}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <InputCard
            title="Row Prediction"
            description="Predict fraud risk by row index from uploaded/default dataset."
            className="border-emerald-400/20"
          >
            <form className="space-y-3" onSubmit={handleRowPrediction}>
              <Input
                type="number"
                value={rowId}
                min={0}
                onChange={(event) => setRowId(event.target.value)}
                placeholder="Enter row number"
              />
              <Button type="submit" className="w-full" disabled={busy.row}>
                {busy.row ? <Spinner /> : "Run Row Prediction"}
              </Button>
            </form>
          </InputCard>

          <InputCard title="Random Test" description="Pick a random row and evaluate automatically.">
            <div className="space-y-3">
              <Button className="w-full" onClick={handleRandomPrediction} disabled={busy.random}>
                {busy.random ? <Spinner /> : "Run Random Test"}
              </Button>
              <Button variant="outline" className="w-full" onClick={navigateToResults}>
                Open Results Dashboard
              </Button>
            </div>
          </InputCard>

          <InputCard title="Paste CSV Row" description="Enter comma-separated values (V1..V28, optional Amount).">
            <form className="space-y-3" onSubmit={handleManualCsvPrediction}>
              <Textarea
                value={csvRowText}
                onChange={(event) => setCsvRowText(event.target.value)}
                placeholder="0.123, -1.5, ... (28 or 29 values)"
              />
              <Button type="submit" className="w-full" disabled={busy.manual}>
                {busy.manual ? <Spinner /> : "Predict from Row Text"}
              </Button>
            </form>
          </InputCard>

          <InputCard title="Dataset Upload" description="Upload a CSV dataset to power row and random tests.">
            <form className="space-y-3" onSubmit={handleCsvUpload}>
              <Input type="file" accept=".csv" onChange={(event) => setCsvFile(event.target.files?.[0] || null)} />
              <Button type="submit" className="w-full" disabled={busy.upload}>
                {busy.upload ? <Spinner /> : "Upload CSV"}
              </Button>
              <p className="text-xs text-slate-400">Only real transaction datasets are accepted. Validation runs on upload.</p>
            </form>
          </InputCard>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <ResultCard result={latestResult} />
          </div>
          <div className="xl:col-span-2">
            <ChartCard result={latestResult} />
          </div>
        </div>

        <div id="history" className="glass-panel rounded-xl p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Prediction History</h2>
              <p className="text-xs text-slate-400">
                Real-time history from Supabase. Total {historyStats.total} records, avg confidence {historyStats.avgConfidence.toFixed(2)}%.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadHistory()} disabled={busy.history}>
              {busy.history ? <Spinner /> : "Refresh"}
            </Button>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={fraudOnly} onChange={(e) => setFraudOnly(e.target.checked)} />
              Fraud only
            </label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <Button
              variant="outline"
              onClick={() => {
                setFraudOnly(false);
                setStartDate("");
                setEndDate("");
              }}
            >
              Clear Filters
            </Button>
          </div>

          {filteredHistory.length === 0 ? (
            <p className="text-sm text-slate-300">{historyEmptyMessage}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full md:min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Model</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{item.input_type}</TableCell>
                      <TableCell>{Number(item.prediction) === 1 ? "Fraud" : "Safe"}</TableCell>
                      <TableCell>{Number(item.confidence).toFixed(2)}%</TableCell>
                      <TableCell>{item.model_used}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
