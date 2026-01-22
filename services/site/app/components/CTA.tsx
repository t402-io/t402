"use client";

import Link from "next/link";
import { motion } from "motion/react";

export function CTA() {
  return (
    <section className="relative py-24">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(80, 175, 149, 0.1), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Headline */}
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to Accept{" "}
            <span className="text-gradient">USDT Payments?</span>
          </h2>

          {/* Description */}
          <p className="mx-auto mt-6 max-w-xl text-lg text-foreground-secondary">
            Start accepting stablecoin payments in minutes. No blockchain
            expertise required. Works with your existing infrastructure.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="https://docs.t402.io/quickstart"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-brand px-8 text-base font-medium transition-all hover:bg-brand-secondary hover:shadow-glow"
              style={{ color: "#0A0A0B" }}
            >
              Start Building
            </Link>
            <Link
              href="https://docs.t402.io"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background-secondary px-8 text-base font-medium text-foreground transition-colors hover:bg-background-tertiary"
            >
              Read the Docs
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-foreground-tertiary">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>Audited Contracts</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-brand"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <span>Open Source</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-info"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
              <span>Cloud Agnostic</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
