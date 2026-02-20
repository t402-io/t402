"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { sdks } from "../sdks/data";

const installCommands: Record<string, string> = {
  typescript: "pnpm add @t402/core @t402/evm",
  python: "pip install t402",
  go: "go get github.com/t402-io/t402/sdks/go",
  java: "io.t402:t402:1.11.0",
};

const packageCounts: Record<string, number> = {
  typescript: 36,
  python: 1,
  go: 1,
  java: 1,
};

export function SDKShowcase() {
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
          <h2 className="text-4xl font-bold tracking-tight text-[var(--text-on-light)] md:text-5xl">
            Official SDKs
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-on-light-secondary)]">
            Production-ready libraries for every major language.
          </p>
        </motion.div>

        {/* SDK cards */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {sdks.map((sdk, index) => (
            <motion.div
              key={sdk.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="card-elevated group p-6"
            >
              {/* Name + version */}
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-[var(--text-on-light)]">
                  {sdk.name}
                </h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: `${sdk.color}15`,
                    color: sdk.color,
                  }}
                >
                  v{sdk.version}
                </span>
              </div>

              {/* Install command */}
              <div className="mt-4 overflow-hidden rounded-lg bg-[#1a1a2e] px-4 py-3">
                <code className="block truncate font-mono text-xs text-[#e2e8f0]">
                  <span className="text-[#50AF95] select-none">$ </span>
                  {installCommands[sdk.id] || sdk.installCommand}
                </code>
              </div>

              {/* Package count */}
              <p className="mt-4 text-sm text-[var(--text-on-light-tertiary)]">
                {packageCounts[sdk.id] || 1} {packageCounts[sdk.id] === 1 ? "package" : "packages"}
              </p>

              {/* Docs link */}
              <Link
                href={sdk.docsUrl}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-secondary"
              >
                View Docs
                <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
