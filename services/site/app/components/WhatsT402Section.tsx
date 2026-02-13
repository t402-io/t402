"use client";

import { motion } from "motion/react";

const features = [
  {
    title: "HTTP Native",
    description:
      "No blockchain knowledge required. Standard HTTP request-response pattern with payment headers.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
        <circle cx="19" cy="18" r="2" />
      </svg>
    ),
  },
  {
    title: "Multi-Chain",
    description:
      "One protocol, 50 networks across 10 blockchain families. Unified payment flow everywhere.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="19" r="3" />
        <circle cx="19" cy="19" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M9 13l-3 3M15 13l3 3" />
      </svg>
    ),
  },
  {
    title: "AI Agent Ready",
    description:
      "Native MCP and A2A transport. Agents discover, evaluate, and pay autonomously.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <circle cx="15.5" cy="8.5" r="1.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14s1.5 2 4 2 4-2 4-2" />
      </svg>
    ),
  },
];

export function WhatsT402Section() {
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
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-primary">
            Protocol
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-[var(--text-on-light)] md:text-5xl">
            What is T402?
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-[var(--text-on-light-secondary)]">
            T402 brings native payments to HTTP. Any web service can require USDT
            payment using the standard 402 status code — no intermediaries, no
            subscription platforms, no blockchain expertise needed.
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card-elevated p-8"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-section-light-alt)] text-brand">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-on-light)]">
                {feature.title}
              </h3>
              <p className="mt-3 text-[var(--text-on-light-secondary)] leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
