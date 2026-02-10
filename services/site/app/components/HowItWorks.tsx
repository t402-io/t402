"use client";

import { motion } from "motion/react";

const steps = [
  {
    number: 1,
    title: "Request Resource",
    description: "Client sends a standard HTTP request to the protected endpoint.",
  },
  {
    number: 2,
    title: "402 Payment Required",
    description: "Server responds with payment requirements: amount, network, and recipient.",
  },
  {
    number: 3,
    title: "Sign & Pay",
    description: "Client signs a USDT payment authorization off-chain. No gas needed.",
  },
  {
    number: 4,
    title: "Access Granted",
    description: "Server verifies the signature, settles on-chain, and returns the resource.",
  },
];

export function HowItWorks() {
  return (
    <section className="section-light-alt py-24 md:py-32">
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
            How It Works
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-[var(--text-on-light)] md:text-5xl">
            Four Simple Steps
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-on-light-secondary)]">
            Standard HTTP 402 payment flow. No blockchain expertise required.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative mt-16">
          {/* Connecting line - desktop */}
          <div className="absolute left-0 right-0 top-10 z-0 hidden h-0.5 lg:block">
            <div className="mx-auto h-full max-w-3xl bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                className="relative text-center"
              >
                {/* Number circle */}
                <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand text-2xl font-bold text-[#0A0A0B]">
                  {step.number}
                </div>

                {/* Content */}
                <h3 className="mt-6 text-lg font-semibold text-[var(--text-on-light)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm text-[var(--text-on-light-secondary)] leading-relaxed">
                  {step.description}
                </p>

                {/* Arrow between steps (desktop) */}
                {index < steps.length - 1 && (
                  <div className="absolute -right-4 top-10 z-10 hidden -translate-y-1/2 lg:block">
                    <svg className="h-5 w-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}

                {/* Arrow between steps (mobile) */}
                {index < steps.length - 1 && (
                  <div className="mt-4 flex justify-center sm:hidden">
                    <svg className="h-5 w-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
