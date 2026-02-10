"use client";

import { motion } from "motion/react";
import Link from "next/link";

const features = [
  {
    slug: "gasless",
    title: "Gasless Payments",
    description:
      "ERC-4337 account abstraction enables gas-free USDT payments across 19+ EVM chains. Users pay only in stablecoins.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    slug: "bridge",
    title: "Cross-Chain Bridge",
    description:
      "LayerZero USDT0 OFT enables seamless cross-chain payments with unified liquidity across 19+ networks.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    slug: "mcp",
    title: "AI Agent MCP Server",
    description:
      "MCP and A2A protocol support enables AI agents to autonomously discover, negotiate, and pay for services.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    slug: "multisig",
    title: "Multi-Signature Wallets",
    description:
      "Safe wallet integration for enterprise treasury management with multi-signature approval workflows.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    slug: "streaming",
    title: "Streaming Payments",
    description:
      "Pay-per-second for continuous access. Real-time metering with auto-topup for AI inference and data feeds.",
    badge: "beta",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h4M8 12h4M14 12h4M20 12h2M6 8l2 4-2 4M12 8l2 4-2 4M18 8l2 4-2 4" />
      </svg>
    ),
  },
  {
    slug: "smart-router",
    title: "Smart Routing",
    description:
      "Automatic cross-chain routing finds the cheapest path considering gas, bridge fees, and token availability.",
    badge: "beta",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
      </svg>
    ),
  },
];

export function FeatureDeepDives() {
  return (
    <section className="section-dark py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Advanced Features
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-secondary">
            Enterprise-grade capabilities built for scale.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <Link href={`/features/${feature.slug}`}>
                <div className="card-elevated-dark group h-full p-6 sm:p-8">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-brand transition-transform group-hover:scale-110">
                      {feature.icon}
                    </div>
                    {feature.badge && (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                        {feature.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-white transition-colors group-hover:text-brand sm:text-xl">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">
                    {feature.description}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-medium text-brand">
                    Learn more
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View All */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Link
            href="/features"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-foreground transition-colors hover:border-brand/50"
          >
            View All Features
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
