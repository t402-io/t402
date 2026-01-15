"use client";

import { motion } from "motion/react";
import Link from "next/link";

const useCases = [
  {
    title: "API Monetization",
    description: "Charge per-request or subscription fees for your API endpoints with zero integration complexity.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    example: "GET /api/data → 402 → Pay $0.001 → Access",
  },
  {
    title: "AI Agent Payments",
    description: "Enable autonomous AI agents to pay for tools, data, and services without human intervention.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    example: "MCP Tool → Auto-pay → Execute",
  },
  {
    title: "Content Paywalls",
    description: "Monetize premium content with instant micropayments. No subscriptions, no friction.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    example: "Article → $0.10 → Instant Access",
  },
];

export function UseCasesPreview() {
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
            Built for Every Use Case
          </h2>
          <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
            From micropayments to enterprise billing, T402 scales with your needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-background-secondary border border-border rounded-xl p-8 hover:border-brand/50 transition-colors group"
            >
              <div className="w-14 h-14 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-6 group-hover:scale-110 transition-transform">
                {useCase.icon}
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-3">
                {useCase.title}
              </h3>

              <p className="text-foreground-secondary mb-6">
                {useCase.description}
              </p>

              {/* Example Flow */}
              <div className="px-4 py-3 bg-background-tertiary rounded-lg font-mono text-sm text-foreground-secondary">
                {useCase.example}
              </div>
            </motion.div>
          ))}
        </div>

        {/* View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Link
            href="/use-cases"
            className="inline-flex items-center gap-2 text-brand hover:text-brand-secondary transition-colors font-medium"
          >
            Explore all 14 use cases
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
