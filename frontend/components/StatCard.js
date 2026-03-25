"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatCard({ title, value, subtitle, icon: Icon, tone = "default" }) {
  const toneClass = tone === "danger"
    ? "border-red-400/30"
    : tone === "success"
      ? "border-emerald-400/30"
      : "border-white/10";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.25, ease: "easeInOut" }}>
      <Card className={toneClass}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base text-slate-100">
            {title}
            {Icon ? <Icon className="h-4 w-4 text-emerald-300" /> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-white">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
