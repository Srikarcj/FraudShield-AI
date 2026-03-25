"use client";

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

const DEFAULT_COLORS = ["#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#06b6d4", "#8b5cf6"];

export default function ChartComponent({
  title,
  type = "bar",
  data = [],
  xKey = "name",
  yKey = "value",
  lines = [],
  pieNameKey = "name",
  pieDataKey = "value",
  height = 280,
  yDomain
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-white/10 bg-slate-900/40 p-2" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {type === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey={xKey} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" domain={yDomain} />
                <Tooltip />
                <Legend />
                {lines.map((line, idx) => (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    name={line.label || line.key}
                    stroke={line.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            ) : type === "pie" ? (
              <PieChart>
                <Pie data={data} dataKey={pieDataKey} nameKey={pieNameKey} outerRadius={90}>
                  {data.map((entry, idx) => (
                    <Cell key={entry[pieNameKey] || idx} fill={DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey={xKey} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" domain={yDomain} />
                <Tooltip />
                <Legend />
                <Bar dataKey={yKey} name={yKey}>
                  {data.map((entry, idx) => (
                    <Cell key={entry[xKey] || idx} fill={DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
