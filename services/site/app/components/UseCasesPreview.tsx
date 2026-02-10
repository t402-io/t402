"use client";

import { motion } from "motion/react";
import Link from "next/link";

const useCases = [
  {
    title: "API Monetization",
    description:
      "Per-call pricing for any API. Add payment requirements to endpoints and charge per-request or per-subscription.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    title: "AI Agent Payments",
    description:
      "Autonomous payments for AI agents. MCP integration lets agents discover, evaluate, and pay for services.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Content Paywalls",
    description:
      "Premium content access with micropayments. No subscriptions needed — pay per article, per view, per download.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

export function UseCasesPreview() {
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
            Use Cases
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-[var(--text-on-light)] md:text-5xl">
            Built for Every Use Case
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-on-light-secondary)]">
            From micropayments to enterprise billing, T402 scales with your needs.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card-elevated group p-8"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-section-light-alt)] text-brand transition-transform group-hover:scale-110">
                {useCase.icon}
              </div>

              <h3 className="text-xl font-semibold text-[var(--text-on-light)]">
                {useCase.title}
              </h3>
              <p className="mt-3 text-[var(--text-on-light-secondary)] leading-relaxed">
                {useCase.description}
              </p>
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
            href="/use-cases"
            className="inline-flex items-center gap-2 font-medium text-brand transition-colors hover:text-brand-secondary"
          >
            View all use cases
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
