"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { transports, comparisonRows } from "./data";

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
    </svg>
  );
}

function BotIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4M8 16h0M16 16h0" />
    </svg>
  );
}

function NetworkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v4M7.5 17.5 10 13M16.5 17.5 14 13" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

const iconMap = {
  http: GlobeIcon,
  mcp: BotIcon,
  a2a: NetworkIcon,
};

export default function TransportsClient() {
  const [activeTab, setActiveTab] = useState<string>("http");

  return (
    <div className="relative overflow-hidden">
      {/* Dark Header */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Transports
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              Multiple Transport Protocols
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              HTTP, MCP, and A2A — one protocol, three transports. From web APIs
              to autonomous AI agents, choose the transport that fits your use case.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Light Section: Transport Cards */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {transports.map((transport, i) => {
              const Icon = iconMap[transport.icon];
              return (
                <motion.div
                  key={transport.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="card-elevated p-8"
                >
                  <div className="mb-5 flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${transport.color}15` }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3
                        className="text-xl font-semibold"
                        style={{ color: "var(--text-on-light)" }}
                      >
                        {transport.name}
                      </h3>
                      {transport.badge && (
                        <span
                          className="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}
                        >
                          {transport.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mb-2 text-sm font-medium" style={{ color: transport.color }}>
                    {transport.tagline}
                  </p>
                  <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--text-on-light-secondary)" }}>
                    {transport.description}
                  </p>

                  <div className="mb-5 space-y-2">
                    <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>
                      <span className="mt-0.5 font-medium" style={{ color: "var(--text-on-light-secondary)" }}>
                        Signal:
                      </span>
                      <span>{transport.mechanism}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-on-light-tertiary)" }}>
                      <span className="mt-0.5 font-medium" style={{ color: "var(--text-on-light-secondary)" }}>
                        Format:
                      </span>
                      <span>{transport.dataFormat}</span>
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-on-light-secondary)" }}>
                      Use cases
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {transport.useCases.map((uc) => (
                        <span
                          key={uc}
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: "var(--bg-section-light-alt)", color: "var(--text-on-light-secondary)" }}
                        >
                          {uc}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {transport.sdkSupport.map((sdk) => (
                      <span
                        key={sdk}
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{ border: "1px solid var(--border-light)", color: "var(--text-on-light-secondary)" }}
                      >
                        {sdk}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dark Section: Code Examples */}
      <section className="section-dark-alt py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Integration
            </span>
            <h2
              className="mt-4 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "#FAFAFA" }}
            >
              Integration Examples
            </h2>
          </motion.div>

          {/* Tabs */}
          <div className="mt-10 mb-6 flex justify-center gap-2">
            {transports.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300"
                style={{
                  backgroundColor: activeTab === t.id ? "rgba(255,255,255,0.1)" : "transparent",
                  color: activeTab === t.id ? "#FAFAFA" : "#A1A1AA",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Code Block */}
          {transports.map((t) =>
            activeTab === t.id ? (
              <motion.div
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-2xl"
                style={{ border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#0d1117" }}
              >
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="text-sm" style={{ color: "#A1A1AA" }}>
                    {t.codeExample.title}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${t.color}20`,
                      color: t.color,
                    }}
                  >
                    {t.codeExample.language}
                  </span>
                </div>
                <pre className="overflow-x-auto p-5 text-sm leading-relaxed" style={{ color: "#A1A1AA", background: "transparent", border: "none" }}>
                  <code>{t.codeExample.code}</code>
                </pre>
              </motion.div>
            ) : null
          )}
        </div>
      </section>

      {/* Light Section: Comparison Table */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Comparison
            </span>
            <h2
              className="mt-4 mb-10 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "var(--text-on-light)" }}
            >
              Transport Comparison
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--border-light)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-light)", backgroundColor: "var(--bg-section-light-alt)" }}>
                    <th
                      className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-on-light-tertiary)" }}
                    >
                      &nbsp;
                    </th>
                    {transports.map((t) => (
                      <th
                        key={t.id}
                        className="px-5 py-4 text-left font-semibold"
                        style={{ color: "var(--text-on-light)" }}
                      >
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.label}
                      style={{
                        borderBottom: i < comparisonRows.length - 1 ? "1px solid var(--border-light)" : "none",
                        backgroundColor: i % 2 === 1 ? "var(--bg-section-light-alt)" : "#FFFFFF",
                      }}
                    >
                      <td className="px-5 py-4 font-medium" style={{ color: "var(--text-on-light)" }}>
                        {row.label}
                      </td>
                      <td className="px-5 py-4" style={{ color: "var(--text-on-light-secondary)" }}>{row.http}</td>
                      <td className="px-5 py-4" style={{ color: "var(--text-on-light-secondary)" }}>{row.mcp}</td>
                      <td className="px-5 py-4" style={{ color: "var(--text-on-light-secondary)" }}>{row.a2a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Dark CTA */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Get Started with Any Transport
            </h3>
            <p className="mx-auto mb-8 max-w-xl text-lg" style={{ color: "#A1A1AA" }}>
              All transports share the same payment verification and settlement
              logic. Choose the transport that fits your use case.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                Get Started
                <ExternalLinkIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/sdks"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all duration-300 hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#FAFAFA" }}
              >
                View SDKs
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
