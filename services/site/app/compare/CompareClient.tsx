"use client";

import Link from "next/link";
import { motion } from "motion/react";

interface ProtocolFeature {
  name: string;
  t402: string;
  x402: string;
}

const protocolFeatures: ProtocolFeature[] = [
  { name: "Multi-Chain Support", t402: "50 networks, 10 families", x402: "EVM only (Base)" },
  { name: "Token Support", t402: "USDT, USDT0, USDC", x402: "USDC only" },
  { name: "AI Agent Support", t402: "MCP + A2A native", x402: "None" },
  { name: "Gasless Payments", t402: "ERC-4337", x402: "No" },
  { name: "Non-EVM Chains", t402: "Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, Cosmos", x402: "None" },
  { name: "Official SDKs", t402: "4 (TS, Go, Python, Java)", x402: "1 (JavaScript)" },
  { name: "HTTP Frameworks", t402: "18 integrations", x402: "1" },
  { name: "Self-Hosted Facilitator", t402: "Yes", x402: "No" },
  { name: "Open Source", t402: "Yes (Apache 2.0)", x402: "Partial" },
  { name: "Settlement Speed", t402: "Instant on-chain", x402: "Delayed" },
];

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
    t402: "50 networks",
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

function isT402Advantage(t402Val: string, x402Val: string): boolean {
  const negatives = ["none", "no", "partial", "delayed", "1", "1 (javascript)"];
  return negatives.includes(x402Val.toLowerCase()) || x402Val.startsWith("EVM only");
}

function ProtocolComparisonTable() {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th
                className="py-4 pr-4 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#71717A" }}
              >
                Feature
              </th>
              <th className="px-6 py-4 text-center">
                <span className="text-lg font-bold" style={{ color: "#50AF95" }}>t402</span>
              </th>
              <th className="px-6 py-4 text-center">
                <span className="text-lg font-semibold" style={{ color: "#A1A1AA" }}>x402</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {protocolFeatures.map((feature, index) => {
              const advantage = isT402Advantage(feature.t402, feature.x402);
              return (
                <motion.tr
                  key={feature.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <td className="py-4 pr-4">
                    <p className="font-medium" style={{ color: "#FAFAFA" }}>{feature.name}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-2">
                      {advantage && <CheckIcon style={{ color: "#50AF95" }} />}
                      <span className="text-sm font-medium" style={{ color: "#50AF95" }}>{feature.t402}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm" style={{ color: "#71717A" }}>{feature.x402}</span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-3 lg:hidden">
        {protocolFeatures.map((feature, index) => (
          <motion.div
            key={feature.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            className="rounded-2xl p-5"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="mb-3 font-medium" style={{ color: "#FAFAFA" }}>{feature.name}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(80,175,149,0.1)" }}>
                <p className="text-xs" style={{ color: "#71717A" }}>t402</p>
                <div className="font-medium" style={{ color: "#50AF95" }}>{feature.t402}</div>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <p className="text-xs" style={{ color: "#71717A" }}>x402</p>
                <div style={{ color: "#A1A1AA" }}>{feature.x402}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
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
              Comparison
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              T402 vs Alternatives
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              See how t402 compares to traditional payment solutions and other crypto
              payment processors. Built for the future of internet payments.
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
              value="50"
              description="10 blockchain families"
            />
            <HighlightCard
              title="Chargebacks"
              value="Zero"
              description="No payment reversals"
            />
          </motion.div>
        </div>
      </section>

      {/* Dark Section: Protocol Comparison (T402 vs x402) */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6">
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
              Protocol Comparison
            </span>
            <h2
              className="mt-4 mb-12 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "#FAFAFA" }}
            >
              How T402 compares to x402
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-2xl p-6 sm:p-8"
            style={{ border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#111113" }}
          >
            <ProtocolComparisonTable />
          </motion.div>
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
              Ready to switch?
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
