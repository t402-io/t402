"use client";

import Link from "next/link";
import { motion } from "motion/react";

interface ComparisonFeature {
  name: string;
  description: string;
  t402: string | boolean;
  stripe: string | boolean;
  paypal: string | boolean;
  coinbase: string | boolean;
  btcpay: string | boolean;
}

const comparisonFeatures: ComparisonFeature[] = [
  {
    name: "Transaction Fees",
    description: "Cost per transaction",
    t402: "0%",
    stripe: "2.9% + $0.30",
    paypal: "2.9% + $0.49",
    coinbase: "1%",
    btcpay: "0%",
  },
  {
    name: "Settlement Time",
    description: "Time to receive funds",
    t402: "Instant",
    stripe: "2-7 days",
    paypal: "1-3 days",
    coinbase: "1-3 days",
    btcpay: "Instant",
  },
  {
    name: "Global Coverage",
    description: "Available worldwide",
    t402: true,
    stripe: "47 countries",
    paypal: "200+ countries",
    coinbase: "100+ countries",
    btcpay: true,
  },
  {
    name: "No KYC Required",
    description: "Start accepting payments immediately",
    t402: true,
    stripe: false,
    paypal: false,
    coinbase: false,
    btcpay: true,
  },
  {
    name: "Chargebacks",
    description: "Risk of payment reversals",
    t402: "None",
    stripe: "Yes",
    paypal: "Yes",
    coinbase: "None",
    btcpay: "None",
  },
  {
    name: "AI Agent Support",
    description: "Native MCP/A2A integration",
    t402: true,
    stripe: false,
    paypal: false,
    coinbase: false,
    btcpay: false,
  },
  {
    name: "Multi-Chain",
    description: "Blockchain support",
    t402: "47 networks",
    stripe: false,
    paypal: false,
    coinbase: "8 chains",
    btcpay: "2 chains",
  },
  {
    name: "Gasless Transactions",
    description: "Users don't need native tokens",
    t402: true,
    stripe: "N/A",
    paypal: "N/A",
    coinbase: false,
    btcpay: false,
  },
  {
    name: "Open Source",
    description: "Fully auditable code",
    t402: true,
    stripe: false,
    paypal: false,
    coinbase: false,
    btcpay: true,
  },
  {
    name: "HTTP Native",
    description: "Built into web protocols (HTTP 402)",
    t402: true,
    stripe: false,
    paypal: false,
    coinbase: false,
    btcpay: false,
  },
  {
    name: "Stablecoin Focus",
    description: "USDT/USDC native support",
    t402: true,
    stripe: false,
    paypal: false,
    coinbase: "Limited",
    btcpay: false,
  },
  {
    name: "Self-Hosted Option",
    description: "Run your own infrastructure",
    t402: true,
    stripe: false,
    paypal: false,
    coinbase: false,
    btcpay: true,
  },
];

function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
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

function XIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function renderValueLight(value: string | boolean) {
  if (value === true) {
    return <CheckIcon className="mx-auto" style={{ color: "#50AF95" }} />;
  }
  if (value === false) {
    return <XIcon className="mx-auto" style={{ color: "#CBD5E0" }} />;
  }
  return <span className="text-sm font-medium">{value}</span>;
}

function MobileComparisonCard({ feature, index }: { feature: ComparisonFeature; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="card-elevated p-5"
    >
      <div className="mb-3">
        <p className="font-medium" style={{ color: "var(--text-on-light)" }}>{feature.name}</p>
        <p className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>{feature.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "rgba(80,175,149,0.05)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>t402</p>
          <div className="font-medium" style={{ color: "#50AF95" }}>{renderValueLight(feature.t402)}</div>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-section-light-alt)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>Stripe</p>
          <div style={{ color: "var(--text-on-light-secondary)" }}>{renderValueLight(feature.stripe)}</div>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-section-light-alt)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>PayPal</p>
          <div style={{ color: "var(--text-on-light-secondary)" }}>{renderValueLight(feature.paypal)}</div>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--bg-section-light-alt)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>Coinbase</p>
          <div style={{ color: "var(--text-on-light-secondary)" }}>{renderValueLight(feature.coinbase)}</div>
        </div>
      </div>
    </motion.div>
  );
}

function ComparisonTable() {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              <th
                className="py-4 pr-4 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-on-light-tertiary)" }}
              >
                Feature
              </th>
              <th className="px-4 py-4 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-lg font-bold" style={{ color: "#50AF95" }}>t402</span>
                  <span className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>Protocol</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-lg font-semibold" style={{ color: "var(--text-on-light)" }}>Stripe</span>
                  <span className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>Traditional</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-lg font-semibold" style={{ color: "var(--text-on-light)" }}>PayPal</span>
                  <span className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>Traditional</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-lg font-semibold" style={{ color: "var(--text-on-light)" }}>Coinbase</span>
                  <span className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>Commerce</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-lg font-semibold" style={{ color: "var(--text-on-light)" }}>BTCPay</span>
                  <span className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>Server</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonFeatures.map((feature, index) => (
              <motion.tr
                key={feature.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                style={{
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <td className="py-4 pr-4">
                  <div>
                    <p className="font-medium" style={{ color: "var(--text-on-light)" }}>{feature.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>{feature.description}</p>
                  </div>
                </td>
                <td
                  className="px-4 py-4 text-center"
                  style={{ backgroundColor: "rgba(80,175,149,0.05)", color: "#50AF95" }}
                >
                  {renderValueLight(feature.t402)}
                </td>
                <td className="px-4 py-4 text-center" style={{ color: "var(--text-on-light-secondary)" }}>
                  {renderValueLight(feature.stripe)}
                </td>
                <td className="px-4 py-4 text-center" style={{ color: "var(--text-on-light-secondary)" }}>
                  {renderValueLight(feature.paypal)}
                </td>
                <td className="px-4 py-4 text-center" style={{ color: "var(--text-on-light-secondary)" }}>
                  {renderValueLight(feature.coinbase)}
                </td>
                <td className="px-4 py-4 text-center" style={{ color: "var(--text-on-light-secondary)" }}>
                  {renderValueLight(feature.btcpay)}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-3 lg:hidden">
        {comparisonFeatures.map((feature, index) => (
          <MobileComparisonCard key={feature.name} feature={feature} index={index} />
        ))}
      </div>
    </>
  );
}

function HighlightCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 text-center"
      style={{ backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-sm" style={{ color: "#A1A1AA" }}>{title}</p>
      <p className="my-2 text-3xl font-bold" style={{ color: "#50AF95" }}>{value}</p>
      <p className="text-sm" style={{ color: "#71717A" }}>{description}</p>
    </div>
  );
}

const t402Strengths = [
  {
    title: "47 Networks",
    desc: "Support 13 blockchain families including EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, and Cosmos.",
  },
  {
    title: "4 Official SDKs",
    desc: "Production-ready SDKs for TypeScript, Python, Go, and Java. Full feature parity across all languages.",
  },
  {
    title: "18 HTTP Integrations",
    desc: "Express, Hono, Fastify, Next.js, Gin, Echo, Chi, Fiber, FastAPI, Flask, Django, Starlette, Servlet, Spring, WebFlux, Micronaut, Quarkus, and Fetch/Axios clients.",
  },
  {
    title: "AI Agent Native",
    desc: "First-class MCP server and A2A transport support. AI agents can discover, negotiate, and pay for resources autonomously.",
  },
  {
    title: "ERC-4337 Gasless",
    desc: "Users pay with stablecoins without needing native gas tokens. Account abstraction powered by ERC-4337 bundlers.",
  },
  {
    title: "Self-Hosted",
    desc: "Run your own facilitator. No vendor lock-in, no third-party dependencies. Full control over your payment infrastructure.",
  },
];

export default function CompareClient() {
  return (
    <div className="relative overflow-hidden">
      {/* Dark Header */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Why T402
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              The Payment Protocol for USDT
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              HTTP-native stablecoin payments with zero fees, instant settlement,
              and the widest multi-chain coverage. Open source under Apache 2.0.
            </p>
          </motion.div>

          {/* Key Highlights in dark header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            <HighlightCard
              title="Transaction Fees"
              value="0%"
              description="No fees on any transaction"
            />
            <HighlightCard
              title="Settlement"
              value="Instant"
              description="Funds available immediately"
            />
            <HighlightCard
              title="Chains Supported"
              value="44"
              description="13 blockchain families"
            />
            <HighlightCard
              title="Chargebacks"
              value="Zero"
              description="No payment reversals"
            />
          </motion.div>
        </div>
      </section>

      {/* Dark Section: T402 Strengths */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Platform
            </span>
            <h2
              className="mt-4 mb-12 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "#FAFAFA" }}
            >
              Built for Scale
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t402Strengths.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <h3 className="mb-3 text-lg font-semibold" style={{ color: "#FAFAFA" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Light Section: Comparison Table */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Features
            </span>
            <h2
              className="mt-4 mb-12 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "var(--text-on-light)" }}
            >
              Feature Comparison
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-2xl p-6 sm:p-8"
            style={{ border: "1px solid var(--border-light)", backgroundColor: "white" }}
          >
            <ComparisonTable />
          </motion.div>
        </div>
      </section>

      {/* Dark Alt Section: Use Cases */}
      <section className="section-dark-alt py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Use Cases
            </span>
            <h2
              className="mt-4 mb-12 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "#FAFAFA" }}
            >
              Perfect For
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "AI Agents", desc: "Native HTTP integration makes t402 the ideal payment rail for autonomous AI agents that need to pay for resources programmatically." },
              { title: "API Monetization", desc: "Charge per API call with zero setup. No payment processor accounts, no KYC, no waiting for payouts." },
              { title: "Global Services", desc: "Accept payments from anywhere in the world. No banking restrictions, no currency conversion fees." },
              { title: "Content Creators", desc: "Monetize content with pay-per-view or pay-per-download. Keep 100% of your earnings with zero platform fees." },
              { title: "Marketplaces", desc: "Dynamic payment routing enables multi-vendor marketplaces with instant settlement to all parties." },
              { title: "High Frequency", desc: "Microtransactions and high-frequency payments without per-transaction overhead. Perfect for gaming and streaming." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="card-elevated-dark p-8"
              >
                <h3 className="mb-3 text-lg font-semibold" style={{ color: "#FAFAFA" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark CTA */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Ready to get started?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg" style={{ color: "#A1A1AA" }}>
              Start accepting stablecoin payments in minutes with our production-ready SDKs.
              No sign-up required.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/sdks"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                View SDKs
              </Link>
              <Link
                href="/playground"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all duration-300 hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#FAFAFA" }}
              >
                Try Playground
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
