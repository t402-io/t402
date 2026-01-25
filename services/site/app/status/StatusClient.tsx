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

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
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
      className="ml-2 rounded p-1 text-gray-500 transition-colors hover:text-gray-300"
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
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return health;
}

function HealthBanner({ health }: { health: HealthStatus }) {
  const statusConfig = {
    loading: {
      bg: "bg-gray-500/10",
      border: "border-gray-500/20",
      dot: "bg-gray-500",
      text: "text-gray-400",
      label: "Checking...",
    },
    operational: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      dot: "bg-emerald-500",
      text: "text-emerald-400",
      label: "All Systems Operational",
    },
    degraded: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      dot: "bg-yellow-500",
      text: "text-yellow-400",
      label: "Partial Outage",
    },
    down: {
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      dot: "bg-red-500",
      text: "text-red-400",
      label: "Service Unavailable",
    },
  };

  const config = statusConfig[health.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-auto max-w-5xl rounded-xl border ${config.border} ${config.bg} p-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`relative flex h-3 w-3`}>
            {health.status === "operational" && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dot} opacity-75`} />
            )}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${config.dot}`} />
          </span>
          <span className={`font-medium ${config.text}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {health.latency !== undefined && (
            <span>Latency: {health.latency}ms</span>
          )}
          {health.supportedNetworks !== undefined && (
            <span>{health.supportedNetworks} networks</span>
          )}
          {health.lastChecked && (
            <span>Updated: {health.lastChecked.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function StatusClient() {
  const health = useHealthCheck();

  // Group networks by family
  const families = networks.reduce(
    (acc, n) => {
      if (!acc[n.family]) acc[n.family] = [];
      acc[n.family].push(n);
      return acc;
    },
    {} as Record<string, typeof networks>
  );

  return (
    <div className="relative overflow-hidden">
      {/* Header */}
      <section className="relative px-6 pt-32 pb-16 md:px-12">
        <div className="mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              Network Status
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              Facilitator service health and supported networks
            </p>
          </motion.div>
        </div>
      </section>

      {/* Health Status Banner */}
      <section className="px-6 pb-8 md:px-12">
        <HealthBanner health={health} />
      </section>

      {/* Service Endpoints */}
      <section className="px-6 pb-12 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-lg font-semibold text-white">
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
                className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {ep.name}
                  </div>
                  <div className="text-xs text-gray-500">{ep.description}</div>
                </div>
                <ExternalLinkIcon className="h-4 w-4 shrink-0 text-gray-500 transition-colors group-hover:text-gray-300" />
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* Facilitator Wallets */}
      <section className="px-6 pb-12 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Facilitator Wallets
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="overflow-hidden rounded-xl border border-white/10"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Family
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Chains
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Address
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      &nbsp;
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {facilitatorWallets.map((w, i) => (
                    <tr
                      key={w.family}
                      className={
                        i < facilitatorWallets.length - 1
                          ? "border-b border-white/5"
                          : ""
                      }
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {w.family}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{w.chains}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <code className="max-w-[200px] truncate text-xs text-gray-400">
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
                          className="text-xs text-emerald-400 hover:text-emerald-300"
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
        </div>
      </section>

      {/* Supported Networks */}
      <section className="px-6 pb-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-lg font-semibold text-white">
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
                <h3 className="mb-2 text-sm font-medium text-gray-300">
                  {family}{" "}
                  <span className="text-gray-500">({nets.length})</span>
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {nets.map((n) => (
                    <div
                      key={n.network}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-white">{n.name}</span>
                      </div>
                      <code className="text-xs text-gray-500">{n.network}</code>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="px-6 pb-24 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-8"
          >
            <p className="mb-4 text-gray-400">
              For real-time monitoring and historical metrics, visit the Grafana
              dashboard.
            </p>
            <Link
              href="https://grafana.facilitator.t402.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Open Grafana Dashboard
              <ExternalLinkIcon className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
