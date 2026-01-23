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
      {/* Header */}
      <section className="relative px-6 pt-32 pb-16 md:px-12">
        <div className="mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              Payment Transports
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              HTTP, MCP, and A2A — one protocol, three transports. From web APIs
              to autonomous AI agents.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Transport Cards */}
      <section className="px-6 pb-16 md:px-12">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {transports.map((transport, i) => {
            const Icon = iconMap[transport.icon];
            return (
              <motion.div
                key={transport.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${transport.color}20` }}
                  >
                    <Icon
                      className="h-5 w-5"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {transport.name}
                    </h3>
                    {transport.badge && (
                      <span className="ml-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        {transport.badge}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mb-3 text-sm font-medium" style={{ color: transport.color }}>
                  {transport.tagline}
                </p>
                <p className="mb-4 text-sm text-gray-400">
                  {transport.description}
                </p>

                <div className="mb-4 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="mt-0.5 font-medium text-gray-400">
                      Signal:
                    </span>
                    <span>{transport.mechanism}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="mt-0.5 font-medium text-gray-400">
                      Format:
                    </span>
                    <span>{transport.dataFormat}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-gray-400">
                    Use cases
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {transport.useCases.map((uc) => (
                      <span
                        key={uc}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400"
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
                      className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-300"
                    >
                      {sdk}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Code Examples */}
      <section className="px-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 text-center text-2xl font-bold text-white md:text-3xl"
          >
            Integration Examples
          </motion.h2>

          {/* Tabs */}
          <div className="mb-6 flex justify-center gap-2">
            {transports.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.id
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
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
                className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <span className="text-sm text-gray-400">
                    {t.codeExample.title}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: `${t.color}20`,
                      color: t.color,
                    }}
                  >
                    {t.codeExample.language}
                  </span>
                </div>
                <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-gray-300">
                  <code>{t.codeExample.code}</code>
                </pre>
              </motion.div>
            ) : null
          )}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 text-center text-2xl font-bold text-white md:text-3xl"
          >
            Transport Comparison
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-xl border border-white/10"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      &nbsp;
                    </th>
                    {transports.map((t) => (
                      <th
                        key={t.id}
                        className="px-4 py-3 text-left font-semibold text-white"
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
                      className={
                        i < comparisonRows.length - 1
                          ? "border-b border-white/5"
                          : ""
                      }
                    >
                      <td className="px-4 py-3 font-medium text-gray-300">
                        {row.label}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{row.http}</td>
                      <td className="px-4 py-3 text-gray-400">{row.mcp}</td>
                      <td className="px-4 py-3 text-gray-400">{row.a2a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-12"
          >
            <h3 className="mb-3 text-2xl font-bold text-white">
              Get Started with Any Transport
            </h3>
            <p className="mb-6 text-gray-400">
              All transports share the same payment verification and settlement
              logic. Choose the transport that fits your use case.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="https://docs.t402.io/transports"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Read the Docs
                <ExternalLinkIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/sdks"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
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
