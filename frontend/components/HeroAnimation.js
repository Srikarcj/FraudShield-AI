"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

const NODES = [
  { x: 30, y: 30 },
  { x: 75, y: 45 },
  { x: 140, y: 35 },
  { x: 195, y: 60 },
  { x: 60, y: 120 },
  { x: 120, y: 100 },
  { x: 180, y: 125 },
  { x: 230, y: 95 },
  { x: 80, y: 180 },
  { x: 155, y: 175 }
];

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [1, 5], [5, 6], [6, 7], [4, 5], [5, 9], [8, 9], [4, 8], [2, 5]
];

export default function HeroAnimation() {
  const [fraudNodes, setFraudNodes] = useState([2, 6]);

  useEffect(() => {
    const interval = setInterval(() => {
      const first = Math.floor(Math.random() * NODES.length);
      let second = Math.floor(Math.random() * NODES.length);
      if (second === first) {
        second = (second + 1) % NODES.length;
      }
      setFraudNodes([first, second]);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-4 backdrop-blur-xl md:h-[420px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.16),transparent_45%)]" />

      <motion.div
        className="absolute left-8 top-10 h-28 w-44 rounded-xl border border-emerald-300/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 p-4 shadow-[0_12px_40px_rgba(16,185,129,0.18)]"
        animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <p className="text-xs uppercase tracking-wider text-emerald-200/90">Transaction</p>
        <p className="mt-3 text-sm font-semibold text-white">Card **** 2409</p>
        <p className="mt-2 text-xs text-slate-300">Streaming to FraudShield AI</p>
      </motion.div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 280 220" preserveAspectRatio="xMidYMid meet">
        {CONNECTIONS.map(([from, to], idx) => {
          const a = NODES[from];
          const b = NODES[to];
          return (
            <motion.line
              key={`line-${idx}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(148,163,184,0.26)"
              strokeWidth="1.5"
              initial={{ pathLength: 0, opacity: 0.15 }}
              animate={{ pathLength: 1, opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 2.5, delay: idx * 0.06, repeat: Infinity, ease: "easeInOut" }}
            />
          );
        })}

        {NODES.map((node, idx) => {
          const isFraud = fraudNodes.includes(idx);
          return (
            <motion.circle
              key={`node-${idx}`}
              cx={node.x}
              cy={node.y}
              r={isFraud ? 5 : 4}
              fill={isFraud ? "#ef4444" : "#22d3ee"}
              animate={isFraud ? { scale: [1, 1.35, 1], opacity: [1, 0.75, 1] } : { scale: 1, opacity: 0.8 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          );
        })}
      </svg>

      {[70, 110, 150].map((top, idx) => (
        <div key={`flow-${top}`} className="pointer-events-none absolute left-0 right-0" style={{ top }}>
          <motion.div
            className="h-1.5 w-14 rounded-full bg-gradient-to-r from-cyan-400/0 via-cyan-300/70 to-cyan-400/0"
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: [0, 260], opacity: [0, 1, 0] }}
            transition={{ duration: 2.2, delay: idx * 0.45, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      ))}

      <motion.div
        className="absolute bottom-8 right-8 flex h-28 w-28 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-500/10 text-emerald-200 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
        animate={{ boxShadow: ["0 0 20px rgba(16,185,129,0.15)", "0 0 42px rgba(16,185,129,0.34)", "0 0 20px rgba(16,185,129,0.15)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ShieldCheck className="h-12 w-12" />
      </motion.div>
    </div>
  );
}
