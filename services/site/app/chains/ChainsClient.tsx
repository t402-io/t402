"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  chains,
  categories,
  features,
  getChainsByCategory,
  type Chain,
  type ChainCategory,
} from "./data";

// Icons
function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function GaslessIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function BridgeIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function WalletIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function MultisigIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  );
}

function ClockIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function DollarIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

const featureIconMap: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  gasless: GaslessIcon,
  bridge: BridgeIcon,
  wallet: WalletIcon,
  multisig: MultisigIcon,
};

function CategoryTab({
  category,
  isSelected,
  onClick,
}: {
  category: { id: ChainCategory; name: string; description: string };
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all"
      style={{
        background: isSelected ? "#50AF95" : "transparent",
        color: isSelected ? "#0A0A0B" : "#718096",
      }}
      aria-pressed={isSelected}
    >
      {category.name}
    </button>
  );
}

function ChainCard({ chain }: { chain: Chain }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="card-elevated group relative overflow-hidden p-6"
    >
      {/* Color accent */}
      <div
        className="absolute left-0 top-0 h-1 w-full"
        style={{ backgroundColor: chain.color }}
      />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${chain.color}15` }}
          >
            <span
              className="h-6 w-6 rounded-full"
              style={{ backgroundColor: chain.color }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "#1A1A2E" }}>{chain.name}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "#718096" }}>{chain.shortName}</span>
              {chain.chainId && (
                <span
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={{ background: "#F7FAF9", color: "#718096" }}
                >
                  Chain {chain.chainId}
                </span>
              )}
            </div>
          </div>
        </div>
        {chain.status === "live" && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: "rgba(80, 175, 149, 0.1)", color: "#50AF95" }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#50AF95" }} />
            Live
          </span>
        )}
        {chain.status === "coming_soon" && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: "rgba(245, 158, 11, 0.1)", color: "#F59E0B" }}
          >
            Coming Soon
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-4 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
        {chain.description}
      </p>

      {/* Tokens */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "#718096" }}>
          Supported Tokens
        </p>
        <div className="flex flex-wrap gap-2">
          {chain.tokens.map((token) => (
            <span
              key={token.symbol}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm"
              style={{ background: "#F7FAF9" }}
            >
              <span className="font-medium" style={{ color: "#1A1A2E" }}>{token.symbol}</span>
              {token.gasless && (
                <span
                  className="rounded px-1 py-0.5 text-[10px] font-medium uppercase"
                  style={{ background: "rgba(80, 175, 149, 0.15)", color: "#50AF95" }}
                >
                  Gasless
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <ClockIcon style={{ color: "#718096" }} />
          <div>
            <p className="text-xs" style={{ color: "#718096" }}>Speed</p>
            <p className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{chain.transactionSpeed}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DollarIcon style={{ color: "#718096" }} />
          <div>
            <p className="text-xs" style={{ color: "#718096" }}>Avg Fee</p>
            <p className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{chain.avgFee}</p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mb-4 flex flex-wrap gap-2">
        {chain.features.slice(0, 3).map((feature) => (
          <span
            key={feature}
            className="rounded-md px-2 py-1 text-xs"
            style={{ background: "#F7FAF9", color: "#718096" }}
          >
            {feature}
          </span>
        ))}
        {chain.features.length > 3 && (
          <span
            className="rounded-md px-2 py-1 text-xs"
            style={{ background: "#F7FAF9", color: "#718096" }}
          >
            +{chain.features.length - 3}
          </span>
        )}
      </div>

      {/* Links */}
      <div className="flex gap-3 pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <Link
          href={`/chains/${chain.id}`}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "#50AF95" }}
        >
          Details
        </Link>
        <Link
          href={chain.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "#4A5568" }}
        >
          Explorer
          <ExternalLinkIcon className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  );
}

function FeatureCard({
  feature,
}: {
  feature: { id: string; name: string; description: string; icon: string };
}) {
  const Icon = featureIconMap[feature.icon] || GaslessIcon;

  return (
    <div className="card-elevated-dark p-6">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: "rgba(80, 175, 149, 0.1)" }}
      >
        <Icon style={{ color: "#50AF95" }} />
      </div>
      <h3 className="mb-2 font-semibold" style={{ color: "#FAFAFA" }}>{feature.name}</h3>
      <p className="text-sm" style={{ color: "#A1A1AA" }}>{feature.description}</p>
    </div>
  );
}

export default function ChainsClient() {
  const [selectedCategory, setSelectedCategory] = useState<ChainCategory | "all">("all");

  const filteredChains =
    selectedCategory === "all"
      ? chains
      : getChainsByCategory(selectedCategory);

  const evmChains = getChainsByCategory("evm");

  return (
    <>
      {/* Hero Section - Dark */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Multi-Chain
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              Supported Chains
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Accept USDT and USDC payments across {chains.length} blockchain networks.
              Multi-chain support with gasless transactions on supported chains.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {[
              { label: "Chains", value: chains.length },
              { label: "EVM Networks", value: evmChains.length },
              { label: "Gasless Chains", value: chains.filter((c) => c.tokens.some((t) => t.gasless)).length },
              { label: "Token Pairs", value: chains.reduce((acc, c) => acc + c.tokens.length, 0) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-4 text-center"
                style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p className="text-3xl font-bold" style={{ color: "#FAFAFA" }}>{stat.value}</p>
                <p className="text-sm" style={{ color: "#71717A" }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Chain Grid - Light Section */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 overflow-x-auto"
          >
            <div className="mx-auto flex w-max min-w-full items-center justify-start gap-2 sm:w-auto sm:justify-center">
              <button
                onClick={() => setSelectedCategory("all")}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all"
                style={{
                  background: selectedCategory === "all" ? "#50AF95" : "transparent",
                  color: selectedCategory === "all" ? "#0A0A0B" : "#718096",
                  border: selectedCategory === "all" ? "none" : "1px solid rgba(0,0,0,0.08)",
                }}
              >
                All Chains
              </button>
              {categories.map((category) => (
                <CategoryTab
                  key={category.id}
                  category={category}
                  isSelected={selectedCategory === category.id}
                  onClick={() => setSelectedCategory(category.id)}
                />
              ))}
            </div>
          </motion.div>

          {/* Chain Grid */}
          <motion.div
            layout
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {filteredChains.map((chain) => (
                <ChainCard key={chain.id} chain={chain} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Multi-Chain Features - Dark Section */}
      <section className="section-dark-alt py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Capabilities
            </span>
            <h2 className="mt-4 mb-12 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Multi-Chain Features
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Light Alt Section */}
      <section className="section-light-alt py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#1A1A2E" }}>
              Ready to go multi-chain?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg" style={{ color: "#4A5568" }}>
              Integrate all supported chains with a single SDK. Our unified API makes it easy to
              accept payments across any network.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/sdks"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold transition-all"
                style={{ background: "#50AF95", color: "#0A0A0B" }}
              >
                View SDKs
              </Link>
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold transition-all"
                style={{ border: "1px solid rgba(0,0,0,0.1)", color: "#1A1A2E" }}
              >
                Get Started
                <ExternalLinkIcon />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
