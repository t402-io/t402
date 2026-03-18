"use client";

import { motion } from "motion/react";

const features = [
  {
    title: "HTTP Native",
    description:
      "Built into standard HTTP request-response cycles. No WebSockets, no polling, no additional infrastructure. Just add a header.",
    colSpan: 2,
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    title: "Gasless (ERC-4337)",
    description:
      "Users pay zero gas fees. EIP-3009 permit signatures and account abstraction handle everything.",
    colSpan: 1,
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "Multi-Chain",
    description:
      "47 networks across 13 blockchain families. EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, and Cosmos.",
    colSpan: 2,
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6" />
      </svg>
    ),
  },
  {
    title: "AI Agent Ready",
    description:
      "MCP and A2A protocol support lets AI agents autonomously discover and pay for services.",
    colSpan: 1,
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Cross-Chain Bridge",
    description:
      "LayerZero USDT0 OFT enables seamless bridging across 19+ EVM networks with unified liquidity.",
    colSpan: 1,
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    title: "Multi-Sig (Safe)",
    description:
      "Enterprise treasury management with Safe wallet multi-signature approval workflows.",
    colSpan: 1,
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Open Source",
    description:
      "Fully open-source protocol. Self-host the facilitator, audit the code, build on top.",
    colSpan: 1,
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

export function FeatureBento() {
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
            Everything You Need
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-on-light-secondary)]">
            A complete payment infrastructure for the multi-chain future.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className={`card-elevated group p-6 sm:p-8 ${
                feature.colSpan === 2 ? "md:col-span-2" : ""
              }`}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-section-light-alt)] text-brand transition-transform group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-on-light)] sm:text-xl">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-on-light-secondary)]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
