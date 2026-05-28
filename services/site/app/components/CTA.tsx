"use client";

import Link from "next/link";
import { motion } from "motion/react";

export function CTA() {
  return (
    <section className="section-dark relative overflow-hidden py-24 md:py-32">
      {/* Brand gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(80, 175, 149, 0.12), transparent)",
        }}
      />

      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(80, 175, 149, 0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Start Building with T402
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-foreground-secondary">
            Open-source HTTP payment protocol. Wire-compatible with x402, plus
            authCapture, dispute, and USDT-on-TRON. Self-host the facilitator or
            use t402 Pay.
          </p>

          {/* Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="https://docs.t402.io"
              className="inline-flex items-center justify-center rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-[#0A0A0B] transition-all hover:bg-brand-secondary hover:shadow-glow"
            >
              Read the Docs
            </Link>
            <Link
              href="https://github.com/t402-io/t402"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-8 py-4 text-lg font-semibold text-white transition-all hover:border-white/40 hover:bg-white/5"
            >
              View on GitHub
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-foreground-tertiary">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Apache 2.0</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>x402-compatible</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              <span>WDK-compatible</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
