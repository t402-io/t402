"use client";

import { motion } from "motion/react";
import Link from "next/link";

const features = [
  {
    slug: "gasless",
    title: "Gasless Transactions",
    description: "ERC-4337 Account Abstraction enables gas-free payments. Users pay only in USDT, no ETH needed.",
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
    description: "LayerZero USDT0 integration enables seamless cross-chain payments across all supported networks.",
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
    title: "AI Agent Ready",
    description: "Model Context Protocol support enables AI agents to autonomously make payments via HTTP 402.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    gradient: "from-purple-500/20 to-pink-500/20",
    borderColor: "hover:border-purple-500/50",
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.slug}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link href={`/features/${feature.slug}`}>
                <div className={`relative bg-background-secondary border border-border rounded-xl p-8 h-full transition-all duration-300 ${feature.borderColor} group cursor-pointer`}>
                  {/* Gradient Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`} />

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl bg-background-tertiary border border-border flex items-center justify-center text-brand mb-6 group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </div>

                    <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-brand transition-colors">
                      {feature.title}
                    </h3>

                    <p className="text-foreground-secondary mb-4">
                      {feature.description}
                    </p>

                    <div className="flex items-center gap-2 text-brand text-sm font-medium">
                      Learn more
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
