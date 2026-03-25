"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Clock3, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AlertCard({ title, riskScore, timestamp, modelName, confidence, level = "fraud" }) {
  const toneClass = level === "fraud"
    ? "border-red-400/40 bg-red-500/10"
    : "border-amber-400/40 bg-amber-500/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
    >
      <Card className={toneClass}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2 text-red-100">
              <ShieldAlert className="h-4 w-4 text-red-300" />
              {title}
            </span>
            <Badge variant={level === "fraud" ? "destructive" : "outline"}>
              {Math.round(Number(riskScore || 0))}/100
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500"
              style={{ width: `${Math.max(0, Math.min(100, Number(riskScore || 0)))}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-200">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
              Confidence: {Number(confidence || 0).toFixed(2)}%
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5 text-slate-300" />
              {timestamp ? new Date(timestamp).toLocaleString() : "N/A"}
            </span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-slate-300">
              {modelName || "Hybrid Stacking"}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
