"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { serviceEndpoints, facilitatorWallets, networks } from "./data";

interface HealthStatus {
  status: "operational" | "degraded" | "down" | "loading";
  latency?: number;
  lastChecked?: Date;
  supportedNetworks?: number;
}

function ExternalLinkIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

function CheckCircleIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="ml-2 rounded p-1 transition-colors hover:opacity-70"
      style={{ color: "#A1A1AA" }}
      title="Copy address"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

function useHealthCheck() {
  const [health, setHealth] = useState<HealthStatus>({ status: "loading" });

  useEffect(() => {
    async function checkHealth() {
      const start = Date.now();
      try {
        const [healthRes, supportedRes] = await Promise.all([
          fetch("https://facilitator.t402.io/health", { cache: "no-store" }),
          fetch("https://facilitator.t402.io/supported", { cache: "no-store" }),
        ]);

        const latency = Date.now() - start;

        if (healthRes.ok && supportedRes.ok) {
          const supportedData = await supportedRes.json();
          const networkCount = supportedData?.kinds?.length ?? 0;
          setHealth({
            status: "operational",
            latency,
            lastChecked: new Date(),
            supportedNetworks: networkCount,
          });
        } else {
          setHealth({
            status: "degraded",
            latency,
            lastChecked: new Date(),
          });
        }
      } catch {
        setHealth({
          status: "down",
          lastChecked: new Date(),
        });
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return health;
}

function HealthBanner({ health }: { health: HealthStatus }) {
  const statusConfig = {
    loading: { dot: "#A1A1AA", text: "#A1A1AA", label: "Checking..." },
    operational: { dot: "#50AF95", text: "#50AF95", label: "All Systems Operational" },
    degraded: { dot: "#EAB308", text: "#EAB308", label: "Partial Outage" },
    down: { dot: "#EF4444", text: "#EF4444", label: "Service Unavailable" },
  };

  const config = statusConfig[health.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 sm:p-5"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {health.status === "operational" && (
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: config.dot }}
              />
            )}
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ backgroundColor: config.dot }}
            />
          </span>
          <span className="text-sm font-medium sm:text-base" style={{ color: config.text }}>
            {config.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm" style={{ color: "#4A5568" }}>
          {health.latency !== undefined && <span>Latency: {health.latency}ms</span>}
          {health.supportedNetworks !== undefined && <span>{health.supportedNetworks} networks</span>}
          {health.lastChecked && (
            <span className="hidden sm:inline">Updated: {health.lastChecked.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function StatusClient() {
  const health = useHealthCheck();

  const families = networks.reduce(
    (acc, n) => {
      if (!acc[n.family]) acc[n.family] = [];
      acc[n.family].push(n);
      return acc;
    },
    {} as Record<string, typeof networks>
  );

  return (
    <>
      {/* Dark Header */}
      <section style={{ backgroundColor: "#0A0A0B" }} className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="uppercase text-xs tracking-widest font-semibold mb-4" style={{ color: "#50AF95" }}>
              Infrastructure
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: "#FAFAFA" }}>
              Network Status
            </h1>
            <p className="mx-auto max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Facilitator service health and supported networks
            </p>
          </motion.div>
        </div>
      </section>

      {/* Light Dashboard */}
      <section style={{ backgroundColor: "#F7FAF9" }} className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6 space-y-12">
          {/* Health Banner */}
          <HealthBanner health={health} />

          {/* Service Endpoints */}
          <div>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: "#1A1A2E" }}>
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
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="group flex items-center justify-between rounded-2xl px-4 py-3 transition-all"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium" style={{ color: "#1A1A2E" }}>
                      {ep.name}
                    </div>
                    <div className="truncate text-xs" style={{ color: "#4A5568" }}>
                      {ep.description}
                    </div>
                  </div>
                  <ExternalLinkIcon className="ml-2 h-4 w-4 shrink-0 transition-colors group-hover:opacity-70" style={{ color: "#A1A1AA" } as React.CSSProperties} />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Facilitator Wallets */}
          <div>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: "#1A1A2E" }}>
              Facilitator Wallets
            </h2>

            {/* Desktop Table */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="hidden overflow-hidden rounded-2xl md:block"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", backgroundColor: "#F7FAF9" }}>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "#4A5568" }}>Family</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "#4A5568" }}>Chains</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "#4A5568" }}>Address</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "#4A5568" }}>&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody style={{ backgroundColor: "#FFFFFF" }}>
                    {facilitatorWallets.map((w, i) => (
                      <tr
                        key={w.family}
                        style={i < facilitatorWallets.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : undefined}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: "#1A1A2E" }}>{w.family}</td>
                        <td className="px-4 py-3" style={{ color: "#4A5568" }}>{w.chains}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <code className="max-w-[200px] truncate text-xs" style={{ color: "#4A5568" }}>
                              {w.address}
                            </code>
                            <CopyButton text={w.address} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={w.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline"
                            style={{ color: "#50AF95" }}
                          >
                            Explorer
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Mobile Cards */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="grid gap-3 md:hidden"
            >
              {facilitatorWallets.map((w) => (
                <div
                  key={w.family}
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium" style={{ color: "#1A1A2E" }}>{w.family}</span>
                    <span className="text-xs" style={{ color: "#4A5568" }}>{w.chains}</span>
                  </div>
                  <div className="mb-3 flex items-center gap-1">
                    <code className="flex-1 truncate text-xs" style={{ color: "#4A5568" }}>
                      {w.address}
                    </code>
                    <CopyButton text={w.address} />
                  </div>
                  <a
                    href={w.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs hover:underline"
                    style={{ color: "#50AF95" }}
                  >
                    View in Explorer
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Supported Networks */}
          <div>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: "#1A1A2E" }}>
              Supported Networks
            </h2>
            <div className="space-y-6">
              {Object.entries(families).map(([family, nets], fi) => (
                <motion.div
                  key={family}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + fi * 0.05 }}
                >
                  <h3 className="mb-2 text-sm font-medium" style={{ color: "#1A1A2E" }}>
                    {family}{" "}
                    <span style={{ color: "#A1A1AA" }}>({nets.length})</span>
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {nets.map((n) => (
                      <div
                        key={n.network}
                        className="flex flex-col gap-1 rounded-xl px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                        style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)" }}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-4 w-4 shrink-0" style={{ color: "#50AF95" } as React.CSSProperties} />
                          <span className="text-sm" style={{ color: "#1A1A2E" }}>{n.name}</span>
                        </div>
                        <code className="truncate pl-6 text-[10px] sm:pl-0 sm:text-xs" style={{ color: "#A1A1AA" }}>
                          {n.network}
                        </code>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Grafana CTA */}
      <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl p-8 sm:p-12"
            style={{ backgroundColor: "#F7FAF9", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <p className="mb-6 text-base" style={{ color: "#4A5568" }}>
              For real-time monitoring and historical metrics, visit the Grafana dashboard.
            </p>
            <Link
              href="https://grafana.facilitator.t402.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all hover:opacity-90"
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
