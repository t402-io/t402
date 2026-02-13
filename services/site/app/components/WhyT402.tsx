"use client";

import { motion } from "motion/react";

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const protocolComparison = [
  { feature: "Networks", t402: "50 (10 families)", x402: "EVM only" },
  { feature: "Tokens", t402: "USDT / USDT0 / USDC", x402: "USDC only" },
  { feature: "AI Agents", t402: "MCP + A2A", x402: "None" },
  { feature: "Gasless", t402: true, x402: false },
  { feature: "SDKs", t402: "4 languages", x402: "JS only" },
  { feature: "Self-hosted", t402: true, x402: false },
];

const traditionalComparison = [
  { feature: "Fees", t402: "0%", stripe: "2.9%", paypal: "2.9%" },
  { feature: "Settlement", t402: "Instant", stripe: "2-7 days", paypal: "1-3 days" },
  { feature: "KYC required", t402: false, stripe: true, paypal: true },
  { feature: "Chargebacks", t402: false, stripe: true, paypal: true },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? <CheckIcon /> : <XIcon />;
  }
  return <span>{value}</span>;
}

export function WhyT402() {
  return (
    <section className="section-dark-alt py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Why <span className="text-gradient">T402</span>?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-secondary">
            Purpose-built for stablecoin payments. No compromises.
          </p>
        </motion.div>

        {/* Tables */}
        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {/* T402 vs x402 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-xl border border-border"
          >
            <div className="bg-background-secondary px-6 py-4">
              <h3 className="text-lg font-semibold text-white">T402 vs x402</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-foreground-tertiary">
                  <th className="px-6 py-3 font-medium">Feature</th>
                  <th className="px-6 py-3 font-medium">T402</th>
                  <th className="px-6 py-3 font-medium">x402</th>
                </tr>
              </thead>
              <tbody>
                {protocolComparison.map((row) => (
                  <tr key={row.feature} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 text-sm text-foreground-secondary">{row.feature}</td>
                    <td className="px-6 py-3 text-sm font-medium text-white">
                      <CellValue value={row.t402} />
                    </td>
                    <td className="px-6 py-3 text-sm text-foreground-secondary">
                      <CellValue value={row.x402} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* T402 vs Traditional */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="overflow-hidden rounded-xl border border-border"
          >
            <div className="bg-background-secondary px-6 py-4">
              <h3 className="text-lg font-semibold text-white">T402 vs Traditional</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-foreground-tertiary">
                  <th className="px-6 py-3 font-medium">Feature</th>
                  <th className="px-6 py-3 font-medium">T402</th>
                  <th className="px-6 py-3 font-medium">Stripe</th>
                  <th className="px-6 py-3 font-medium">PayPal</th>
                </tr>
              </thead>
              <tbody>
                {traditionalComparison.map((row) => (
                  <tr key={row.feature} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 text-sm text-foreground-secondary">{row.feature}</td>
                    <td className="px-6 py-3 text-sm font-medium text-white">
                      <CellValue value={row.t402} />
                    </td>
                    <td className="px-6 py-3 text-sm text-foreground-secondary">
                      <CellValue value={row.stripe} />
                    </td>
                    <td className="px-6 py-3 text-sm text-foreground-secondary">
                      <CellValue value={row.paypal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
