"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const COLORS = ["#34d399", "#f87171", "#60a5fa", "#fbbf24", "#c084fc", "#22d3ee", "#fb7185"];

export default function ChartCard({ result }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const chartStyles = useMemo(() => {
    return {
      tickFont: isDesktop ? 12 : 10,
      legendFont: isDesktop ? 12 : 10,
      pieRadius: isDesktop ? 95 : 85,
      barRadius: isDesktop ? 4 : 3,
      lineWidth: isDesktop ? 3 : 2,
      dotSize: isDesktop ? 4 : 3
    };
  }, [isDesktop]);

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300">Prediction charts appear here after a test run.</p>
        </CardContent>
      </Card>
    );
  }

  const isFraud = Number(result.prediction) === 1;
  const pieData = [
    { name: "Fraud", value: isFraud ? 1 : 0 },
    { name: "Safe", value: isFraud ? 0 : 1 }
  ];

  const componentEntries = Object.entries(result.component_scores || {}).map(([name, value]) => ({
    name,
    value: Number(value)
  }));

  const legendStyle = {
    color: "#cbd5f5",
    fontSize: chartStyles.legendFont
  };

  const tooltipStyle = {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderColor: "rgba(148, 163, 184, 0.3)",
    color: "#e2e8f0",
    fontSize: chartStyles.legendFont
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Charts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-900/50 p-3 sm:h-60 lg:h-80 lg:p-4">
            <div className="h-full w-full max-w-[320px] aspect-square">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={chartStyles.pieRadius}
                    cx="50%"
                    cy="50%"
                    stroke="#f8fafc"
                    strokeWidth={1}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={entry.name} fill={idx === 0 ? "#ef4444" : "#22c55e"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={legendStyle} align="center" verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="h-60 overflow-x-auto rounded-lg border border-white/10 bg-slate-900/50 p-3 lg:col-span-2 lg:h-72 lg:overflow-visible lg:p-4">
            <div className="h-full min-w-[320px] sm:min-w-[420px] lg:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={componentEntries} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: chartStyles.tickFont }} />
                  <YAxis stroke="#94a3b8" domain={[0, 1]} tick={{ fontSize: chartStyles.tickFont }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar dataKey="value" radius={[chartStyles.barRadius, chartStyles.barRadius, 0, 0]}>
                    {componentEntries.map((item, idx) => (
                      <Cell key={item.name} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="h-64 overflow-x-auto rounded-lg border border-white/10 bg-slate-900/50 p-3 lg:h-80 lg:overflow-visible lg:p-4">
          <div className="h-full min-w-[320px] sm:min-w-[420px] lg:min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={componentEntries} margin={{ bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: chartStyles.tickFont }} />
                <YAxis stroke="#94a3b8" domain={[0, 1]} tick={{ fontSize: chartStyles.tickFont }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={chartStyles.lineWidth} dot={{ r: chartStyles.dotSize }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
