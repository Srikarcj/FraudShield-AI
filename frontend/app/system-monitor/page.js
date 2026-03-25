"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Gauge, RadioTower, Server, Timer } from "lucide-react";
import StatCard from "@/components/StatCard";
import ChartComponent from "@/components/ChartComponent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getApiStatus, randomTest } from "@/lib/api";
import { useAuth } from "@/lib/authContext";

const POLL_MS = 10000;

export default function SystemMonitorPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [busy, setBusy] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [modelMessage, setModelMessage] = useState("Checking API...");
  const [responseMs, setResponseMs] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [lastCallAt, setLastCallAt] = useState(null);
  const [series, setSeries] = useState([]);

  const runProbe = async () => {
    setBusy(true);

    let statusOk = false;
    let statusPayload = null;
    const statusStart = performance.now();

    try {
      statusPayload = await getApiStatus();
      statusOk = true;
    } catch {
      statusOk = false;
    }

    const statusElapsed = Math.max(1, Math.round(performance.now() - statusStart));

    let modelElapsed = 0;
    if (statusOk) {
      const modelStart = performance.now();
      try {
        await randomTest();
      } catch {
        // keep monitor page usable even if random_test has temporary dataset errors
      }
      modelElapsed = Math.max(1, Math.round(performance.now() - modelStart));
    }

    const nowLabel = new Date().toLocaleTimeString();

    setApiConnected(statusOk);
    setModelMessage(statusPayload?.model_message || (statusOk ? "API online" : "API disconnected"));
    setResponseMs(statusElapsed);
    setLatencyMs(modelElapsed);
    setLastCallAt(Date.now());
    setSeries((prev) => {
      const next = [...prev, { time: nowLabel, response: statusElapsed, model_latency: modelElapsed }];
      return next.slice(-20);
    });

    setBusy(false);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?mode=signin");
      return;
    }

    runProbe();
    const timer = setInterval(runProbe, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  const healthText = useMemo(() => {
    if (!apiConnected) return "Disconnected";
    if (responseMs < 300) return "Healthy";
    if (responseMs < 800) return "Degraded";
    return "Slow";
  }, [apiConnected, responseMs]);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Infrastructure</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">System Monitor</h1>
            <p className="mt-2 text-sm text-slate-300">{modelMessage}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={apiConnected ? "default" : "destructive"}>
              {apiConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Button variant="outline" onClick={runProbe} disabled={busy}>
              {busy ? <Spinner /> : "Run Check"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="API Status" value={apiConnected ? "Online" : "Offline"} subtitle={`Health: ${healthText}`} icon={Server} tone={apiConnected ? "success" : "danger"} />
        <StatCard title="Response Time" value={`${responseMs} ms`} subtitle="/api/status round trip" icon={Timer} tone="default" />
        <StatCard title="Model Latency" value={`${latencyMs} ms`} subtitle="/api/random_test latency" icon={Gauge} tone="default" />
        <StatCard title="Last API Call" value={lastCallAt ? new Date(lastCallAt).toLocaleTimeString() : "-"} subtitle="Latest completed probe" icon={Activity} tone="default" />
      </div>

      <ChartComponent
        title="API Performance Timeline"
        type="line"
        data={series}
        xKey="time"
        lines={[
          { key: "response", label: "Response (ms)", color: "#22d3ee" },
          { key: "model_latency", label: "Model Latency (ms)", color: "#34d399" }
        ]}
      />

      <div className="glass-panel rounded-xl p-5">
        <h2 className="mb-2 text-lg font-semibold text-white">Operational Notes</h2>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-cyan-300" />Probes run automatically every {POLL_MS / 1000}s.</li>
          <li>Response time tracks backend health endpoint round-trip.</li>
          <li>Model latency tracks live prediction endpoint execution time.</li>
        </ul>
      </div>
    </section>
  );
}
