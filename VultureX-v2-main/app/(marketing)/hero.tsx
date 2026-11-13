"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  stats: { startups: number; investors: number; connections: number };
};

export function HeroSection({ stats }: Props) {
  return (
    <section className="px-6 pt-28 pb-20 md:pt-36 md:pb-28 border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: copy */}
        <div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-[48px] font-semibold leading-[1.1] tracking-[-0.02em]">
            The network where{" "}
            <span className="text-[var(--accent)]">startups get funded</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-5 text-sm md:text-base text-[var(--text-secondary)] leading-relaxed max-w-md">
            Show verified traction, connect with the right investors, close deals faster. No gatekeepers, no warm intros needed.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-8 flex items-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors">
              Get started <ArrowRight size={14} />
            </Link>
            <Link href="/explore" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              Browse startups →
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-10 flex gap-8">
            {[
              { value: stats.startups, label: "Startups" },
              { value: stats.investors, label: "Investors" },
              { value: stats.connections, label: "Connections" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}>
                <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right: product mockup card */}
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="hidden lg:block">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-lg shadow-black/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-[var(--accent-muted)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">G</div>
                <div>
                  <p className="text-sm font-medium">GreenPath</p>
                  <p className="text-[10px] text-[var(--text-muted)]">climate · seed</p>
                </div>
              </div>
            </div>

            {/* Score */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-[var(--accent)] tabular-nums">82</span>
              <span className="text-xs text-[var(--text-muted)]">/ 100</span>
            </div>

            {/* Bars */}
            <div className="space-y-2 mb-5">
              {[
                { label: "Traction", pct: 86 },
                { label: "Financial", pct: 80 },
                { label: "Team", pct: 87 },
                { label: "Market", pct: 87 },
                { label: "Momentum", pct: 60 },
              ].map((bar, i) => (
                <div key={bar.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] w-14">{bar.label}</span>
                  <div className="flex-1 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${bar.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: "easeOut" }}
                      className="h-full rounded-full bg-[var(--accent-fill)]" />
                  </div>
                </div>
              ))}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--border)]">
              <div>
                <p className="text-sm font-semibold">$47K</p>
                <p className="text-[9px] text-[var(--text-muted)]">MRR</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--green)] flex items-center gap-0.5">
                  <TrendingUp size={10} /> 34%
                </p>
                <p className="text-[9px] text-[var(--text-muted)]">Growth</p>
              </div>
              <div>
                <p className="text-sm font-semibold">45</p>
                <p className="text-[9px] text-[var(--text-muted)]">Customers</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
