"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { features, type Feature } from "./data";

// Icons
type IconProps = { className?: string; style?: React.CSSProperties };

function GaslessIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
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
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function BridgeIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
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
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function MCPIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
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
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function MultisigIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
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
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  );
}

function ArrowRightIcon({ className = "", style }: IconProps) {
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
      style={style}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
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

const iconMap: Record<string, React.FC<IconProps>> = {
  gasless: GaslessIcon,
  bridge: BridgeIcon,
  mcp: MCPIcon,
  multisig: MultisigIcon,
};

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = iconMap[feature.icon] || GaslessIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link
        href={`/features/${feature.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background-secondary p-8 transition-all hover:border-border-secondary hover:shadow-lg"
      >
        {/* Color accent line */}
        <div
          className="absolute left-0 top-0 h-1 w-full transition-all group-hover:h-1.5"
          style={{ backgroundColor: feature.color }}
        />

        {/* Icon */}
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${feature.color}20` }}
        >
          <Icon className="h-7 w-7" style={{ color: feature.color }} />
        </div>

        {/* Content */}
        <h3 className="mb-2 text-xl font-semibold text-foreground">{feature.name}</h3>
        <p className="mb-4 text-sm font-medium" style={{ color: feature.color }}>
          {feature.tagline}
        </p>
        <p className="mb-6 flex-1 text-sm leading-relaxed text-foreground-secondary">
          {feature.description}
        </p>

        {/* Supported chains */}
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-tertiary">
            Supported Chains
          </p>
          <div className="flex flex-wrap gap-1.5">
            {feature.supportedChains.slice(0, 4).map((chain) => (
              <span
                key={chain}
                className="rounded-md bg-background-tertiary px-2 py-1 text-xs text-foreground-tertiary"
              >
                {chain}
              </span>
            ))}
            {feature.supportedChains.length > 4 && (
              <span className="rounded-md bg-background-tertiary px-2 py-1 text-xs text-foreground-tertiary">
                +{feature.supportedChains.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2 text-sm font-medium transition-colors group-hover:text-brand">
          <span style={{ color: feature.color }}>Learn more</span>
          <ArrowRightIcon
            className="transition-transform group-hover:translate-x-1"
            style={{ color: feature.color }}
          />
        </div>
      </Link>
    </motion.div>
  );
}

export default function FeaturesClient() {
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
          Features
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
          Advanced capabilities that make t402 the most powerful payment protocol for stablecoins.
          From gasless transactions to AI agent payments.
        </p>
      </motion.div>

      {/* Feature Grid */}
      <div className="mb-20 grid gap-8 md:grid-cols-2">
        {features.map((feature, index) => (
          <FeatureCard key={feature.id} feature={feature} index={index} />
        ))}
      </div>

      {/* Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-20"
      >
        <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
          Feature Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-sm font-semibold text-foreground">Feature</th>
                <th className="p-4 text-center text-sm font-semibold text-foreground">
                  EVM Chains
                </th>
                <th className="p-4 text-center text-sm font-semibold text-foreground">Solana</th>
                <th className="p-4 text-center text-sm font-semibold text-foreground">TON</th>
                <th className="p-4 text-center text-sm font-semibold text-foreground">TRON</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-4 text-sm text-foreground">Gasless Transactions</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-4 text-sm text-foreground">Cross-Chain Bridge</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-4 text-sm text-foreground">AI Agent Payments (MCP)</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-foreground-tertiary">Soon</td>
                <td className="p-4 text-center text-foreground-tertiary">Soon</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-4 text-sm text-foreground">Multi-Sig Support</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
                <td className="p-4 text-center text-foreground-tertiary">—</td>
              </tr>
              <tr>
                <td className="p-4 text-sm text-foreground">USDT/USDC Payments</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-brand">✓</td>
                <td className="p-4 text-center text-brand">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="rounded-2xl border border-border bg-background-secondary p-8 text-center sm:p-12"
      >
        <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
          Ready to explore?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
          Dive deep into each feature or check out our documentation for implementation guides.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="https://docs.t402.io/features"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
            style={{ color: "#0A0A0B" }}
          >
            Read Documentation
            <ExternalLinkIcon />
          </Link>
          <Link
            href="/sdks"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
          >
            View SDKs
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
