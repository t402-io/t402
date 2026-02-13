"use client";

import { motion } from "motion/react";

function HTTPIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" />
      <circle cx="19" cy="18" r="2" />
    </svg>
  );
}

function MultiChainIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
      <path d="M12 8v4M9 13l-3 3M15 13l3 3" />
    </svg>
  );
}

function GaslessIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function AIIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <circle cx="15.5" cy="8.5" r="1.5" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    </svg>
  );
}

const valueProps = [
  {
    icon: HTTPIcon,
    title: "HTTP Native",
    description:
      "Payments are HTTP headers. Works with any web framework, CDN, or API gateway. No blockchain knowledge required.",
    color: "text-brand",
  },
  {
    icon: MultiChainIcon,
    title: "Multi-Chain",
    description:
      "One SDK, 50 networks. EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, Cosmos and more with unified payment flows across 10 blockchain families.",
    color: "text-chain-ethereum",
  },
  {
    icon: GaslessIcon,
    title: "Gasless Transactions",
    description:
      "ERC-4337 account abstraction enables gas-free payments. Users pay with USDT, you cover the rest.",
    color: "text-warning",
  },
  {
    icon: AIIcon,
    title: "AI Agent Ready",
    description:
      "Built-in MCP server for Claude, GPT, and other AI agents. Autonomous payments for the autonomous web.",
    color: "text-info",
  },
];

export function ValueProps() {
  return (
    <section className="section-light py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-4xl font-bold tracking-tight text-[var(--text-on-light)] md:text-5xl">
            Built for Modern Development
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-on-light-secondary)]">
            Everything you need to accept stablecoin payments, nothing you don't.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {valueProps.map((prop, index) => {
            const Icon = prop.icon;
            return (
              <motion.div
                key={prop.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card-elevated p-8"
              >
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-section-light-alt)] ${prop.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-on-light)]">
                  {prop.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-on-light-secondary)]">
                  {prop.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
