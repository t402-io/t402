"use client";

import { motion } from "motion/react";
import { useFacilitatorStatus } from "@/hooks/useFacilitatorStatus";
import { Activity, Globe, Wallet, Server } from "lucide-react";

const wallets = [
  { chain: "EVM (all)", address: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B" },
  { chain: "Solana", address: "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL" },
  { chain: "TON", address: "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a" },
  { chain: "TRON", address: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5" },
];

const endpoints = [
  { method: "GET", path: "/health", desc: "Liveness probe" },
  { method: "GET", path: "/ready", desc: "Readiness probe" },
  { method: "GET", path: "/supported", desc: "Supported networks/schemes" },
  { method: "POST", path: "/verify", desc: "Verify payment authorization" },
  { method: "POST", path: "/settle", desc: "Execute on-chain settlement" },
  { method: "GET", path: "/metrics", desc: "Prometheus metrics" },
];

const networkFamilies = [
  { family: "EVM", count: 17, color: "#627EEA" },
  { family: "Solana", count: 1, color: "#9945FF" },
  { family: "TON", count: 1, color: "#0098EA" },
  { family: "TRON", count: 1, color: "#FF0013" },
  { family: "NEAR", count: 2, color: "#00C1DE" },
  { family: "Aptos", count: 2, color: "#2DD8A3" },
  { family: "Tezos", count: 2, color: "#2C7DF7" },
  { family: "Polkadot", count: 2, color: "#E6007A" },
  { family: "Stacks", count: 2, color: "#5546FF" },
];

export default function StatusSection() {
  const { online, supportedNetworks, url, loading } = useFacilitatorStatus();

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`h-3 w-3 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
        <h2 className="text-[var(--text-section)] font-bold text-white">
          Facilitator {online ? "Online" : "Offline"}
        </h2>
        <span className="text-sm text-[var(--color-muted)]">{url}</span>
      </div>

      <div className="grid grid-cols-2 gap-6 flex-1">
        {/* Left: Networks */}
        <div className="space-y-5">
          {/* Network matrix */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Globe size={16} className="text-[var(--color-brand)]" />
              <h3 className="text-sm font-semibold text-white">Supported Networks</h3>
              <span className="ml-auto text-xs text-[var(--color-muted)]">{supportedNetworks || 30} total</span>
            </div>
            <div className="space-y-2">
              {networkFamilies.map((nf) => (
                <div key={nf.family} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: nf.color }} />
                    <span className="text-sm text-white/80">{nf.family}</span>
                  </div>
                  <span className="text-sm font-mono text-[var(--color-muted)]">{nf.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* API Endpoints */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Server size={16} className="text-[var(--color-brand)]" />
              <h3 className="text-sm font-semibold text-white">API Endpoints</h3>
            </div>
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <div key={ep.path} className="flex items-center gap-3">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    ep.method === "GET" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                  }`}>
                    {ep.method}
                  </span>
                  <span className="text-sm font-mono text-white/80">{ep.path}</span>
                  <span className="text-xs text-[var(--color-muted)] ml-auto">{ep.desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right: Wallets + Protocol info */}
        <div className="space-y-5">
          {/* Wallets */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Wallet size={16} className="text-[var(--color-brand)]" />
              <h3 className="text-sm font-semibold text-white">Facilitator Wallets</h3>
            </div>
            <div className="space-y-3">
              {wallets.map((w) => (
                <div key={w.chain}>
                  <div className="text-xs text-[var(--color-muted)] mb-0.5">{w.chain}</div>
                  <div className="text-xs font-mono text-white/70 break-all">{w.address}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Protocol info */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-[var(--color-brand)]" />
              <h3 className="text-sm font-semibold text-white">Protocol Details</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Versions</span>
                <span className="text-white/80">v1, v2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Schemes</span>
                <span className="text-white/80">exact, upto</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Transports</span>
                <span className="text-white/80">HTTP, MCP, A2A</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Testnet</span>
                <span className="text-white/80">Base Sepolia (84532)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Token</span>
                <span className="text-white/80">USDT / USDT0</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
