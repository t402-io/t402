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
function CheckIcon({ className = "" }: { className?: string }) {
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

function GaslessIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function BridgeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function WalletIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function MultisigIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function DollarIcon({ className = "" }: { className?: string }) {
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
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

const featureIconMap: Record<string, React.FC<{ className?: string }>> = {
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
      className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        isSelected
          ? "text-foreground"
          : "text-foreground-tertiary hover:text-foreground-secondary"
      }`}
      aria-pressed={isSelected}
    >
      {isSelected && (
        <motion.div
          layoutId="activeCategory"
          className="absolute inset-0 rounded-lg bg-background-tertiary"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-10">{category.name}</span>
    </button>
  );
}

function ChainCard({ chain }: { chain: Chain }) {
  const hasGasless = chain.tokens.some((t) => t.gasless);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-background-secondary p-6 transition-all hover:border-border-secondary"
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
            style={{ backgroundColor: `${chain.color}20` }}
          >
            <span
              className="h-6 w-6 rounded-full"
              style={{ backgroundColor: chain.color }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{chain.name}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground-tertiary">{chain.shortName}</span>
              {chain.chainId && (
                <span className="rounded bg-background-tertiary px-1.5 py-0.5 text-xs text-foreground-tertiary">
                  Chain {chain.chainId}
                </span>
              )}
            </div>
          </div>
        </div>
        {chain.status === "live" && (
          <span className="flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            Live
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-4 text-sm leading-relaxed text-foreground-secondary">
        {chain.description}
      </p>

      {/* Tokens */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-tertiary">
          Supported Tokens
        </p>
        <div className="flex flex-wrap gap-2">
          {chain.tokens.map((token) => (
            <span
              key={token.symbol}
              className="flex items-center gap-1.5 rounded-md bg-background-tertiary px-2.5 py-1 text-sm"
            >
              <span className="font-medium text-foreground">{token.symbol}</span>
              {token.gasless && (
                <span className="rounded bg-brand/20 px-1 py-0.5 text-[10px] font-medium uppercase text-brand">
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
          <ClockIcon className="text-foreground-tertiary" />
          <div>
            <p className="text-xs text-foreground-tertiary">Speed</p>
            <p className="text-sm font-medium text-foreground">{chain.transactionSpeed}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DollarIcon className="text-foreground-tertiary" />
          <div>
            <p className="text-xs text-foreground-tertiary">Avg Fee</p>
            <p className="text-sm font-medium text-foreground">{chain.avgFee}</p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mb-4 flex flex-wrap gap-2">
        {chain.features.slice(0, 3).map((feature) => (
          <span
            key={feature}
            className="rounded-md bg-background-tertiary px-2 py-1 text-xs text-foreground-tertiary"
          >
            {feature}
          </span>
        ))}
        {chain.features.length > 3 && (
          <span className="rounded-md bg-background-tertiary px-2 py-1 text-xs text-foreground-tertiary">
            +{chain.features.length - 3}
          </span>
        )}
      </div>

      {/* Links */}
      <div className="flex gap-3 border-t border-border pt-4">
        <Link
          href={chain.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-foreground-secondary transition-colors hover:text-foreground"
        >
          Explorer
          <ExternalLinkIcon className="h-3 w-3" />
        </Link>
        <Link
          href={chain.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-foreground-secondary transition-colors hover:text-foreground"
        >
          Docs
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
    <div className="rounded-xl border border-border bg-background-secondary p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10">
        <Icon className="text-brand" />
      </div>
      <h3 className="mb-2 font-semibold text-foreground">{feature.name}</h3>
      <p className="text-sm text-foreground-secondary">{feature.description}</p>
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
  const otherChains = chains.filter((c) => c.category !== "evm");

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16 text-center"
      >
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Supported Chains
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
          Accept USDT and USDC payments across {chains.length} blockchain networks.
          Multi-chain support with gasless transactions on supported chains.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{chains.length}</p>
          <p className="text-sm text-foreground-tertiary">Chains</p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{evmChains.length}</p>
          <p className="text-sm text-foreground-tertiary">EVM Networks</p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">
            {chains.filter((c) => c.tokens.some((t) => t.gasless)).length}
          </p>
          <p className="text-sm text-foreground-tertiary">Gasless Chains</p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">
            {chains.reduce((acc, c) => acc + c.tokens.length, 0)}
          </p>
          <p className="text-sm text-foreground-tertiary">Token Pairs</p>
        </div>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mb-8 flex flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-background-secondary p-1.5"
      >
        <button
          onClick={() => setSelectedCategory("all")}
          className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            selectedCategory === "all"
              ? "text-foreground"
              : "text-foreground-tertiary hover:text-foreground-secondary"
          }`}
        >
          {selectedCategory === "all" && (
            <motion.div
              layoutId="activeCategory"
              className="absolute inset-0 rounded-lg bg-background-tertiary"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">All Chains</span>
        </button>
        {categories.map((category) => (
          <CategoryTab
            key={category.id}
            category={category}
            isSelected={selectedCategory === category.id}
            onClick={() => setSelectedCategory(category.id)}
          />
        ))}
      </motion.div>

      {/* Chain Grid */}
      <motion.div
        layout
        className="mb-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AnimatePresence mode="popLayout">
          {filteredChains.map((chain) => (
            <ChainCard key={chain.id} chain={chain} />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-20"
      >
        <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
          Multi-Chain Features
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </motion.div>

      {/* Integration CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-2xl border border-border bg-background-secondary p-8 text-center sm:p-12"
      >
        <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
          Ready to go multi-chain?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
          Integrate all supported chains with a single SDK. Our unified API makes it easy to
          accept payments across any network.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/sdks"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
            style={{ color: "#0A0A0B" }}
          >
            View SDKs
          </Link>
          <Link
            href="https://docs.t402.io/chains"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
          >
            Chain Documentation
            <ExternalLinkIcon />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
