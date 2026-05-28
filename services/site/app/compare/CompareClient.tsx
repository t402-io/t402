"use client";

import Link from "next/link";
import { motion } from "motion/react";

function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function HighlightCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 text-center"
      style={{ backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-sm" style={{ color: "#A1A1AA" }}>{title}</p>
      <p className="my-2 text-3xl font-bold" style={{ color: "#50AF95" }}>{value}</p>
      <p className="text-sm" style={{ color: "#71717A" }}>{description}</p>
    </div>
  );
}

interface X402Row {
  feature: string;
  t402: string | boolean;
  x402: string | boolean;
}

const x402Comparison: X402Row[] = [
  { feature: "exact scheme", t402: true, x402: true },
  { feature: "upto scheme", t402: true, x402: true },
  { feature: "authCapture scheme", t402: "Spec + SDK (Phase B)", x402: "Spec + EVM SDK" },
  { feature: "batch-settlement scheme", t402: "Spec + SDK (Phase B)", x402: "Spec + EVM SDK + contract deployed" },
  { feature: "MCP transport (AI agents)", t402: "33 tools", x402: "~10 tools" },
  { feature: "A2A transport", t402: true, x402: true },
  { feature: "USDT-on-TRON facilitator", t402: "Production", x402: "PR #2076 open since Jan" },
  { feature: "TON USDT support", t402: "4 SDKs production", x402: "Spec merged; TS facilitator WIP" },
  { feature: "ERC-4337 / ERC-7710 smart wallets", t402: "Full impl, 4 SDKs", x402: "ERC-6492 merged" },
  { feature: "Dispute / refund envelope", t402: "Draft extension", x402: false },
  { feature: "Self-host facilitator (Apache 2.0)", t402: true, x402: true },
  { feature: "SDK languages", t402: "TS, Go, Py, Java", x402: "TS, Go, Py, Java minimal" },
  { feature: "WDK integration (Tether)", t402: "Structurally typed, compat-tested", x402: "Independent" },
];

const t402Strengths = [
  {
    title: "47 Networks",
    desc: "Support 13 blockchain families including EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, and Cosmos.",
  },
  {
    title: "4 Official SDKs",
    desc: "Production-ready SDKs for TypeScript, Python, Go, and Java. Full feature parity across all languages.",
  },
  {
    title: "18 HTTP Integrations",
    desc: "Express, Hono, Fastify, Next.js, Gin, Echo, Chi, Fiber, FastAPI, Flask, Django, Starlette, Servlet, Spring, WebFlux, Micronaut, Quarkus, and Fetch/Axios clients.",
  },
  {
    title: "AI Agent Native",
    desc: "First-class MCP server and A2A transport support. AI agents can discover, negotiate, and pay for resources autonomously.",
  },
  {
    title: "ERC-4337 Gasless",
    desc: "Users pay with stablecoins without needing native gas tokens. Account abstraction powered by ERC-4337 bundlers.",
  },
  {
    title: "Self-Hosted",
    desc: "Run your own facilitator. No vendor lock-in, no third-party dependencies. Full control over your payment infrastructure.",
  },
];

export default function CompareClient() {
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
              Why T402
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              The HTTP Payment Protocol for Stablecoins
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              HTTP-native stablecoin payments with zero protocol fees, instant settlement,
              and the widest multi-chain coverage. Open source under Apache 2.0.
            </p>
          </motion.div>

          {/* Key Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-3"
          >
            <HighlightCard
              title="Protocol Fees"
              value="0%"
              description="Apache 2.0, free forever"
            />
            <HighlightCard
              title="Settlement"
              value="Instant"
              description="On-chain finality, no holds"
            />
            <HighlightCard
              title="Chains Supported"
              value="47"
              description="13 blockchain families"
            />
          </motion.div>
        </div>
      </section>

      {/* Dark Section: T402 Strengths */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
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
              Platform
            </span>
            <h2
              className="mt-4 mb-12 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "#FAFAFA" }}
            >
              Built for Scale
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t402Strengths.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <h3 className="mb-3 text-lg font-semibold" style={{ color: "#FAFAFA" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark Section: T402 vs x402 (interop + leadership) */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
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
              x402 Interop
            </span>
            <h2
              className="mt-4 mb-4 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: "#FAFAFA" }}
            >
              t402 vs x402
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-base" style={{ color: "#A1A1AA" }}>
              t402 is wire-compatible with x402, the open HTTP payment protocol maintained by
              the x402 Foundation. The two protocols share schemes and transports.
              t402 leads on dispute, USDT-on-TRON, and the WDK integration.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-2xl"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#111113" }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="py-4 px-6 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#A1A1AA" }}>
                    Feature
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="text-lg font-bold" style={{ color: "#50AF95" }}>t402</span>
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="text-lg font-semibold" style={{ color: "#FAFAFA" }}>x402</span>
                      <span className="text-xs" style={{ color: "#A1A1AA" }}>Foundation</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {x402Comparison.map((row, index) => (
                  <motion.tr
                    key={row.feature}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td className="py-4 px-6 text-sm font-medium" style={{ color: "#FAFAFA" }}>
                      {row.feature}
                    </td>
                    <td
                      className="py-4 px-4 text-center text-sm"
                      style={{ backgroundColor: "rgba(80,175,149,0.05)", color: "#50AF95" }}
                    >
                      {typeof row.t402 === "boolean"
                        ? row.t402
                          ? <CheckIcon className="mx-auto" style={{ color: "#50AF95" }} />
                          : <XIcon className="mx-auto" style={{ color: "#CBD5E0" }} />
                        : row.t402}
                    </td>
                    <td className="py-4 px-4 text-center text-sm" style={{ color: "#A1A1AA" }}>
                      {typeof row.x402 === "boolean"
                        ? row.x402
                          ? <CheckIcon className="mx-auto" style={{ color: "#A1A1AA" }} />
                          : <XIcon className="mx-auto" style={{ color: "#CBD5E0" }} />
                        : row.x402}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <p className="mt-6 text-center text-sm" style={{ color: "#71717A" }}>
            t402 ships upstream-PR-ready specs for dispute, USDT-on-TRON, and TON
            facilitator coverage.
          </p>
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
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Ready to get started?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg" style={{ color: "#A1A1AA" }}>
              Production-ready SDKs in 4 languages. No sign-up required.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/sdks"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                View SDKs
              </Link>
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all duration-300 hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#FAFAFA" }}
              >
                Read Quickstart
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
