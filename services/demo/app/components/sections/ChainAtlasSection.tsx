"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useAccount, useSwitchChain } from "wagmi";
import { chains, chainFamilies } from "@/lib/chains";

export default function ChainAtlasSection() {
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [filterFamily, setFilterFamily] = useState<string | null>(null);
  const { chain: connectedChain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  const filteredChains = filterFamily
    ? chains.filter((c) => c.family === filterFamily)
    : chains;

  const selected = chains.find((c) => c.id === selectedChain);

  return (
    <div className="flex h-full">
      {/* Left: Chain grid */}
      <div className="flex flex-1 flex-col p-6 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-[var(--text-section)] font-bold text-white">{chains.length} Chains</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {chainFamilies.length} blockchain families — click for details
          </p>
        </div>

        {/* Family filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterFamily(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !filterFamily ? "bg-white/10 text-white" : "text-[var(--color-muted)] hover:text-white"
            }`}
          >
            All ({chains.length})
          </button>
          {chainFamilies.map((f) => {
            const count = chains.filter((c) => c.family === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilterFamily(f === filterFamily ? null : f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterFamily === f ? "bg-white/10 text-white" : "text-[var(--color-muted)] hover:text-white"
                }`}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-5 gap-2.5 lg:grid-cols-6">
          {filteredChains.map((chain) => (
            <motion.button
              key={chain.id}
              onClick={() => setSelectedChain(chain.id === selectedChain ? null : chain.id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                selectedChain === chain.id
                  ? "border-[var(--color-brand)]/50 bg-[var(--color-brand)]/5"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-white/20"
              }`}
            >
              <div className="h-5 w-5 rounded-full" style={{ backgroundColor: chain.color }} />
              <span className="text-center text-xs text-white leading-tight">{chain.name}</span>
              {chain.gasless && (
                <span className="text-[9px] text-[var(--color-brand)]">gasless</span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Right: Details */}
      <div className="flex w-[360px] shrink-0 flex-col border-l border-[var(--color-border)] p-6 overflow-y-auto">
        {isConnected && connectedChain && (
          <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="text-xs font-medium text-green-400 mb-1">Wallet Connected</div>
            <div className="text-xs text-white/70">Chain: {connectedChain.name} (ID: {connectedChain.id})</div>
          </div>
        )}

        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full" style={{ backgroundColor: selected.color }} />
              <div>
                <div className="text-lg font-semibold text-white">{selected.name}</div>
                <div className="text-xs text-[var(--color-muted)]">{selected.family}</div>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">CAIP-2</span>
                <span className="font-mono text-xs text-white/80">{selected.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Gasless</span>
                <span className={selected.gasless ? "text-[var(--color-brand)]" : "text-white/50"}>
                  {selected.gasless ? "Yes (EIP-3009)" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Asset</span>
                <span className="text-white/80">USDT / USDT0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Scheme</span>
                <span className="text-white/80">exact</span>
              </div>
            </div>

            {/* PaymentRequirements snippet */}
            <pre className="mt-4 rounded-lg bg-[var(--color-code-bg)] p-3 text-[11px] text-gray-400 leading-relaxed overflow-x-auto">
{`{
  "scheme": "exact",
  "network": "${selected.network}",
  "asset": "0x...",
  "payTo": "0xC88f67...899B"
}`}
            </pre>

            {selected.family === "EVM" && isConnected && (
              <button
                onClick={() => {
                  const chainId = parseInt(selected.network.split(":")[1]);
                  switchChain({ chainId });
                }}
                className="mt-4 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-2 text-sm text-white hover:border-white/20 transition-colors"
              >
                Switch to {selected.name}
              </button>
            )}
          </motion.div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted)]">
            Click a chain to view details
          </div>
        )}
      </div>
    </div>
  );
}
