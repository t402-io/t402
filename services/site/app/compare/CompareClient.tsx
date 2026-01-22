"use client";

import Link from "next/link";
import { motion } from "motion/react";

interface ComparisonFeature {
  name: string;
  description: string;
  t402: string | boolean;
  stripe: string | boolean;
  paypal: string | boolean;
  crypto: string | boolean;
}

const comparisonFeatures: ComparisonFeature[] = [
  {
    name: "Transaction Fees",
    description: "Cost per transaction",
    t402: "0%",
    stripe: "2.9% + $0.30",
    paypal: "2.9% + $0.49",
    crypto: "1-3%",
  },
  {
    name: "Settlement Time",
    description: "Time to receive funds",
    t402: "Instant",
    stripe: "2-7 days",
    paypal: "1-3 days",
    crypto: "Minutes-Hours",
  },
  {
    name: "Global Coverage",
    description: "Available worldwide",
    t402: true,
    stripe: "47 countries",
    paypal: "200+ countries",
    crypto: true,
  },
  {
    name: "No KYC Required",
    description: "Start accepting payments immediately",
    t402: true,
    stripe: false,
    paypal: false,
    crypto: "Varies",
  },
  {
    name: "Chargebacks",
    description: "Risk of payment reversals",
    t402: "None",
    stripe: "Yes",
    paypal: "Yes",
    crypto: "None",
  },
  {
    name: "AI Agent Support",
    description: "Native support for autonomous agents",
    t402: true,
    stripe: false,
    paypal: false,
    crypto: false,
  },
  {
    name: "Multi-Chain",
    description: "Support for multiple blockchains",
    t402: "10 chains",
    stripe: false,
    paypal: false,
    crypto: "1-3 chains",
  },
  {
    name: "Gasless Transactions",
    description: "Users don't need native tokens",
    t402: true,
    stripe: "N/A",
    paypal: "N/A",
    crypto: false,
  },
  {
    name: "Open Source",
    description: "Fully auditable code",
    t402: true,
    stripe: false,
    paypal: false,
    crypto: "Varies",
  },
  {
    name: "HTTP Native",
    description: "Built into web protocols",
    t402: true,
    stripe: false,
    paypal: false,
    crypto: false,
  },
];

function CheckIcon({ className = "" }: { className?: string }) {
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
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className = "" }: { className?: string }) {
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
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function renderValue(value: string | boolean) {
  if (value === true) {
    return <CheckIcon className="mx-auto text-brand" />;
  }
  if (value === false) {
    return <XIcon className="mx-auto text-foreground-tertiary" />;
  }
  return <span className="text-sm font-medium">{value}</span>;
}

function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="py-4 pr-4 text-left text-sm font-medium text-foreground-tertiary">
              Feature
            </th>
            <th className="px-4 py-4 text-center">
              <div className="inline-flex flex-col items-center">
                <span className="text-lg font-bold text-brand">t402</span>
                <span className="text-xs text-foreground-tertiary">Protocol</span>
              </div>
            </th>
            <th className="px-4 py-4 text-center">
              <div className="inline-flex flex-col items-center">
                <span className="text-lg font-semibold text-foreground">Stripe</span>
                <span className="text-xs text-foreground-tertiary">Traditional</span>
              </div>
            </th>
            <th className="px-4 py-4 text-center">
              <div className="inline-flex flex-col items-center">
                <span className="text-lg font-semibold text-foreground">PayPal</span>
                <span className="text-xs text-foreground-tertiary">Traditional</span>
              </div>
            </th>
            <th className="px-4 py-4 text-center">
              <div className="inline-flex flex-col items-center">
                <span className="text-lg font-semibold text-foreground">Crypto</span>
                <span className="text-xs text-foreground-tertiary">Processors</span>
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
              className="border-b border-border"
            >
              <td className="py-4 pr-4">
                <div>
                  <p className="font-medium text-foreground">{feature.name}</p>
                  <p className="text-xs text-foreground-tertiary">{feature.description}</p>
                </div>
              </td>
              <td className="px-4 py-4 text-center bg-brand/5">
                {renderValue(feature.t402)}
              </td>
              <td className="px-4 py-4 text-center text-foreground-secondary">
                {renderValue(feature.stripe)}
              </td>
              <td className="px-4 py-4 text-center text-foreground-secondary">
                {renderValue(feature.paypal)}
              </td>
              <td className="px-4 py-4 text-center text-foreground-secondary">
                {renderValue(feature.crypto)}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <div className="rounded-xl border border-border bg-background-secondary p-6 text-center">
      <p className="text-sm text-foreground-tertiary">{title}</p>
      <p className="my-2 text-3xl font-bold text-brand">{value}</p>
      <p className="text-sm text-foreground-secondary">{description}</p>
    </div>
  );
}

export default function CompareClient() {
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
          Why t402?
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
          See how t402 compares to traditional payment solutions and other crypto
          payment processors. Built for the future of internet payments.
        </p>
      </motion.div>

      {/* Key Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
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
          value="10"
          description="One SDK, all networks"
        />
        <HighlightCard
          title="Chargebacks"
          value="Zero"
          description="No payment reversals"
        />
      </motion.div>

      {/* Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-20 rounded-xl border border-border bg-background-secondary p-6 sm:p-8"
      >
        <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
          Feature Comparison
        </h2>
        <ComparisonTable />
      </motion.div>

      {/* Use Cases */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-20"
      >
        <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
          Perfect For
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-background-secondary p-6">
            <h3 className="mb-2 text-lg font-semibold text-foreground">AI Agents</h3>
            <p className="text-sm text-foreground-secondary">
              Native HTTP integration makes t402 the ideal payment rail for autonomous
              AI agents that need to pay for resources programmatically.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-6">
            <h3 className="mb-2 text-lg font-semibold text-foreground">API Monetization</h3>
            <p className="text-sm text-foreground-secondary">
              Charge per API call with zero setup. No payment processor accounts,
              no KYC, no waiting for payouts.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-6">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Global Services</h3>
            <p className="text-sm text-foreground-secondary">
              Accept payments from anywhere in the world. No banking restrictions,
              no currency conversion fees.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-6">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Content Creators</h3>
            <p className="text-sm text-foreground-secondary">
              Monetize content with pay-per-view or pay-per-download. Keep 100% of
              your earnings with zero platform fees.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-6">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Marketplaces</h3>
            <p className="text-sm text-foreground-secondary">
              Dynamic payment routing enables multi-vendor marketplaces with instant
              settlement to all parties.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-6">
            <h3 className="mb-2 text-lg font-semibold text-foreground">High Frequency</h3>
            <p className="text-sm text-foreground-secondary">
              Microtransactions and high-frequency payments without per-transaction
              overhead. Perfect for gaming and streaming.
            </p>
          </div>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="rounded-2xl border border-border bg-background-secondary p-8 text-center sm:p-12"
      >
        <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
          Ready to switch?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
          Start accepting stablecoin payments in minutes with our production-ready SDKs.
          No sign-up required.
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
            href="/playground"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
          >
            Try Playground
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
