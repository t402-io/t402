"use client";

import { motion } from "motion/react";

const stats = [
  {
    value: "7",
    label: "Chains Supported",
    description: "EVM, TON, TRON, Solana",
  },
  {
    value: "4",
    label: "SDKs Available",
    description: "TypeScript, Python, Go, Rust",
  },
  {
    value: "$0",
    label: "Protocol Fees",
    description: "Only network gas fees",
  },
  {
    value: "< 1s",
    label: "Verification Time",
    description: "Instant payment validation",
  },
];

export function Stats() {
  return (
    <section className="relative border-y border-border bg-background-secondary py-20">
      {/* Background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(80, 175, 149, 0.15) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl font-bold text-brand sm:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-lg font-medium">{stat.label}</div>
              <div className="mt-1 text-sm text-foreground-tertiary">
                {stat.description}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
