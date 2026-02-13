"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { serviceEndpoints, facilitatorWallets, networks } from "./data";

/* ── Types ─────────────────────────────────────────────── */

interface HealthStatus {
  status: "operational" | "degraded" | "down" | "loading";
  latency?: number;
  lastChecked?: Date;
  supportedNetworks?: number;
}

/* ── Icons ─────────────────────────────────────────────── */

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded p-1 transition-colors hover:bg-white/10"
      title="Copy address"
    >
      {copied ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#50AF95" strokeWidth={2}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5 text-foreground-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

/* ── Health Hook ───────────────────────────────────────── */

const FACILITATOR_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "/_facilitator"
    : "https://facilitator.t402.io";

function useHealthCheck() {
  const [health, setHealth] = useState<HealthStatus>({ status: "loading" });

  const checkHealth = useCallback(async () => {
    const start = Date.now();
    try {
      const [healthRes, supportedRes] = await Promise.all([
        fetch(`${FACILITATOR_BASE}/health`, { cache: "no-store" }),
        fetch(`${FACILITATOR_BASE}/supported`, { cache: "no-store" }),
      ]);
      const latency = Date.now() - start;
      if (healthRes.ok && supportedRes.ok) {
        const supportedData = await supportedRes.json();
        setHealth({
          status: "operational",
          latency,
          lastChecked: new Date(),
          supportedNetworks: supportedData?.kinds?.length ?? 0,
        });
      } else {
        setHealth({ status: "degraded", latency, lastChecked: new Date() });
      }
    } catch {
      setHealth({ status: "down", lastChecked: new Date() });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return health;
}

/* ── Status Dot ────────────────────────────────────────── */

const statusStyles = {
  loading: { color: "#71717A", label: "Checking..." },
  operational: { color: "#50AF95", label: "Operational" },
  degraded: { color: "#EAB308", label: "Degraded" },
  down: { color: "#EF4444", label: "Unavailable" },
};

function StatusDot({ status }: { status: HealthStatus["status"] }) {
  const { color } = statusStyles[status];
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "operational" && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/* ── Stat Card ─────────────────────────────────────────── */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#71717A" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ color: "#FAFAFA" }}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: "#71717A" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────── */

export default function StatusClient() {
  const health = useHealthCheck();
  const { color: statusColor, label: statusLabel } = statusStyles[health.status];

  const familyGroups = networks.reduce(
    (acc, n) => {
      if (!acc[n.family]) acc[n.family] = [];
      acc[n.family].push(n);
      return acc;
    },
    {} as Record<string, typeof networks>,
  );

  const evmNets = familyGroups["EVM"] ?? [];
  const nonEvmFamilies = Object.entries(familyGroups).filter(([f]) => f !== "EVM");

  return (
    <>
      {/* ── Dark Hero + Health Banner ── */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Infrastructure
            </p>
            <h1
              className="mt-4 text-4xl font-bold tracking-tight md:text-5xl"
              style={{ color: "#FAFAFA" }}
            >
              Network Status
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "#A1A1AA" }}>
              Real-time health of the T402 facilitator and all supported networks.
            </p>
          </motion.div>

          {/* Health Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-12 max-w-2xl rounded-2xl px-6 py-5"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: `1px solid ${health.status === "operational" ? "rgba(80,175,149,0.3)" : health.status === "down" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusDot status={health.status} />
                <span className="text-base font-semibold" style={{ color: statusColor }}>
                  {health.status === "loading" ? "Checking..." : statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: "#71717A" }}>
                {health.latency !== undefined && <span>{health.latency}ms</span>}
                {health.lastChecked && (
                  <span className="hidden sm:inline">
                    {health.lastChecked.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Stat Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            <StatCard
              label="Networks"
              value={health.supportedNetworks !== undefined ? String(health.supportedNetworks) : "—"}
              sub="payment kinds"
            />
            <StatCard label="Families" value={String(Object.keys(familyGroups).length)} sub="blockchain families" />
            <StatCard label="Mainnets" value={String(networks.length)} sub="mainnet chains" />
            <StatCard
              label="Latency"
              value={health.latency !== undefined ? `${health.latency}ms` : "—"}
              sub="round-trip"
            />
          </motion.div>
        </div>
      </section>

      {/* ── Light Section: Endpoints + Wallets ── */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6 space-y-16">
          {/* Service Endpoints */}
          <div>
            <h2
              className="mb-6 text-xl font-bold tracking-tight"
              style={{ color: "var(--text-on-light)" }}
            >
              Service Endpoints
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {serviceEndpoints.map((ep, i) => (
                <motion.a
                  key={ep.name}
                  href={ep.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="card-elevated group flex items-center gap-4 p-4 transition-all hover:border-brand/30"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(80,175,149,0.08)" }}
                  >
                    <span className="text-sm font-bold" style={{ color: "#50AF95" }}>
                      {ep.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-on-light)" }}>
                      {ep.name}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>
                      {ep.description}
                    </p>
                  </div>
                  <ExternalLinkIcon className="h-4 w-4 shrink-0 text-[var(--text-on-light-tertiary)] transition-transform group-hover:translate-x-0.5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Facilitator Wallets */}
          <div>
            <h2
              className="mb-6 text-xl font-bold tracking-tight"
              style={{ color: "var(--text-on-light)" }}
            >
              Facilitator Wallets
            </h2>
            <div className="grid gap-3">
              {facilitatorWallets.map((w, i) => (
                <motion.div
                  key={w.family}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ backgroundColor: "rgba(80,175,149,0.08)", color: "#50AF95" }}
                    >
                      {w.family.slice(0, 3)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-on-light)" }}>
                        {w.family}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>
                        {w.chains}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-12 sm:pl-0">
                    <code
                      className="max-w-[240px] truncate rounded-md px-2 py-1 text-xs"
                      style={{
                        backgroundColor: "var(--bg-section-light-alt)",
                        color: "var(--text-on-light-secondary)",
                      }}
                    >
                      {w.address}
                    </code>
                    <CopyButton text={w.address} />
                    <a
                      href={w.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium hover:underline"
                      style={{ color: "#50AF95" }}
                    >
                      Explorer
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Dark Section: Supported Networks ── */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Coverage
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Supported Networks
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base" style={{ color: "#A1A1AA" }}>
              All mainnet chains supported by the facilitator.
            </p>
          </motion.div>

          {/* EVM — compact pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12"
          >
            <div className="mb-3 flex items-center gap-2">
              <h3
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: "#71717A" }}
              >
                EVM
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: "rgba(80,175,149,0.12)", color: "#50AF95" }}
              >
                {evmNets.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {evmNets.map((n) => (
                <span
                  key={n.network}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors hover:border-white/20"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#A1A1AA",
                  }}
                >
                  <StatusDot status="operational" />
                  {n.name}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Non-EVM — cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {nonEvmFamilies.map(([family, nets]) => (
              <div
                key={family}
                className="rounded-xl px-4 py-3"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center gap-2">
                  <StatusDot status="operational" />
                  <span className="text-sm font-medium" style={{ color: "#FAFAFA" }}>
                    {nets[0].name}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-mono" style={{ color: "#71717A" }}>
                  {nets[0].network}
                </p>
                {nets.length > 1 && (
                  <p className="mt-1 text-xs" style={{ color: "#50AF95" }}>
                    +{nets.length - 1} more
                  </p>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Light CTA: Grafana ── */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2
              className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: "var(--text-on-light)" }}
            >
              Real-Time Monitoring
            </h2>
            <p
              className="mx-auto mb-8 max-w-md text-base"
              style={{ color: "var(--text-on-light-secondary)" }}
            >
              Historical metrics, alerting, and detailed dashboards on Grafana.
            </p>
            <Link
              href="https://grafana.facilitator.t402.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
            >
              Open Grafana Dashboard
              <ExternalLinkIcon className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
