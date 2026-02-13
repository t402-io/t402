"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { chains, categories, type ChainCategory } from "../chains/data";

export function NetworkGrid() {
  const grouped = categories.map((cat) => ({
    ...cat,
    chains: chains.filter((c) => c.category === cat.id),
  }));

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
            Every Chain.{" "}
            <span className="text-gradient">One Protocol.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-secondary">
            50 networks across 10 blockchain families, all accessible through a single unified API.
          </p>
        </motion.div>

        {/* Chain groups */}
        <div className="mt-16 space-y-8">
          {grouped.map((group, groupIndex) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: groupIndex * 0.06 }}
            >
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-foreground-tertiary">
                {group.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.chains.map((chain) => (
                  <span
                    key={chain.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-foreground-secondary transition-colors hover:border-white/[0.15] hover:text-white"
                  >
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: chain.color }}
                    />
                    {chain.shortName}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Link
            href="/chains"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-foreground transition-colors hover:border-brand/50"
          >
            Explore All Chains
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
