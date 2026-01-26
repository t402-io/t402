"use client";

import { motion } from "motion/react";
import Link from "next/link";

const features = [
  {
    slug: "gasless",
    title: "Gasless Transactions",
    description: "EIP-3009 and ERC-4337 enable gas-free USDT0 payments across 19+ EVM chains. Users pay only in stablecoins.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    gradient: "from-yellow-500/20 to-orange-500/20",
    borderColor: "hover:border-yellow-500/50",
  },
  {
    slug: "bridge",
    title: "Cross-Chain Bridge",
    description: "LayerZero USDT0 OFT enables seamless cross-chain payments across 19+ networks with unified liquidity.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    gradient: "from-blue-500/20 to-cyan-500/20",
    borderColor: "hover:border-blue-500/50",
  },
  {
    slug: "mcp",
    title: "AI Agent Payments",
    description: "MCP and A2A protocol support enables AI agents to autonomously discover, negotiate, and pay for services.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    gradient: "from-purple-500/20 to-pink-500/20",
    borderColor: "hover:border-purple-500/50",
  },
  {
    slug: "streaming",
    title: "Streaming Payments",
    description: "Pay-per-second for continuous access. Real-time metering with auto-topup for AI inference and data feeds.",
    badge: "beta",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 12h4M8 12h4M14 12h4M20 12h2M6 8l2 4-2 4M12 8l2 4-2 4M18 8l2 4-2 4" />
      </svg>
    ),
    gradient: "from-cyan-500/20 to-teal-500/20",
    borderColor: "hover:border-cyan-500/50",
  },
  {
    slug: "smart-router",
    title: "Smart Payment Router",
    description: "Automatic cross-chain routing finds the cheapest path considering gas, bridge fees, and token availability.",
    badge: "beta",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
      </svg>
    ),
    gradient: "from-orange-500/20 to-red-500/20",
    borderColor: "hover:border-orange-500/50",
  },
  {
    slug: "multisig",
    title: "Multi-Sig Support",
    description: "Safe wallet integration for enterprise treasury management with multi-signature approvals.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    gradient: "from-green-500/20 to-emerald-500/20",
    borderColor: "hover:border-green-500/50",
  },
];

export function FeatureDeepDives() {
  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Advanced Features
          </h2>
          <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
            Enterprise-grade capabilities built for scale
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.slug}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link href={`/features/${feature.slug}`}>
                <div className={`relative h-full cursor-pointer rounded-xl border border-border bg-background-secondary p-5 transition-all duration-300 sm:p-8 ${feature.borderColor} group`}>
                  {/* Gradient Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`} />

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="mb-4 flex items-center justify-between sm:mb-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background-tertiary text-brand transition-transform group-hover:scale-110 sm:h-14 sm:w-14">
                        {feature.icon}
                      </div>
                      {feature.badge && (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                          {feature.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="mb-2 text-lg font-semibold text-foreground transition-colors group-hover:text-brand sm:mb-3 sm:text-xl">
                      {feature.title}
                    </h3>

                    <p className="mb-4 text-sm text-foreground-secondary">
                      {feature.description}
                    </p>

                    <div className="flex items-center gap-2 text-sm font-medium text-brand">
                      Learn more
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View All Features Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Link
            href="/features"
            className="inline-flex items-center gap-2 px-6 py-3 bg-background-secondary border border-border rounded-lg text-foreground hover:border-brand/50 transition-colors"
          >
            View All Features
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
