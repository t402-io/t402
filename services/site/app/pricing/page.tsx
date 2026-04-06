import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Pricing | t402",
  description:
    "Simple, transparent pricing. Free for developers. Pay only when you scale. 0.1% settlement fee — 15x cheaper than Stripe.",
  openGraph: {
    title: "t402 Pricing - Free to Start, Scales with You",
    description:
      "Free tier: 1,000 tx/month. Builder: 0.1%. Scale: $99/mo + 0.08%. Enterprise: custom. No hidden fees.",
  },
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For developers and testing",
    highlight: false,
    features: [
      "1,000 transactions/month",
      "All 13 chain mechanisms",
      "4 SDK languages",
      "Public facilitator",
      "Community support",
      "No credit card required",
    ],
    cta: "Get API Key",
    ctaHref: "https://facilitator.t402.io/register",
  },
  {
    name: "Builder",
    price: "0.1%",
    period: "per transaction",
    description: "For apps with real users",
    highlight: true,
    features: [
      "100,000 transactions/month",
      "100 RPM rate limit",
      "Webhook callbacks",
      "Settlement fee tracking",
      "Priority support",
      "Cross-chain bridging",
    ],
    cta: "Start Building",
    ctaHref: "https://facilitator.t402.io/register",
  },
  {
    name: "Scale",
    price: "$99",
    period: "/month + 0.08%",
    description: "For growing businesses",
    highlight: false,
    features: [
      "1,000,000 transactions/month",
      "1,000 RPM rate limit",
      "Analytics dashboard",
      "Revenue reports",
      "Dedicated RPC endpoints",
      "Email + chat support",
    ],
    cta: "Contact Sales",
    ctaHref: "mailto:sales@t402.io",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "tailored",
    description: "For platforms at scale",
    highlight: false,
    features: [
      "Unlimited transactions",
      "10,000+ RPM",
      "99.99% SLA guarantee",
      "Dedicated facilitator",
      "Custom settlement logic",
      "Dedicated account manager",
    ],
    cta: "Talk to Us",
    ctaHref: "mailto:enterprise@t402.io",
  },
];

const comparisons = [
  { provider: "Stripe (stablecoin)", fee: "1.50%", savings: "15x cheaper" },
  { provider: "BitPay", fee: "1.00%", savings: "10x cheaper" },
  { provider: "Coinbase Commerce", fee: "1.00%", savings: "10x cheaper" },
  { provider: "NOWPayments", fee: "0.50%", savings: "5x cheaper" },
  { provider: "t402 (Builder)", fee: "0.10%", savings: "—", highlight: true },
  { provider: "Self-hosted t402", fee: "0.00%", savings: "Free forever", highlight: true },
];

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" style={{ color: "#50AF95" }}>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        {/* Hero */}
        <section className="section-dark py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Pricing
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Free for developers. Pay only when you scale.
              <br />
              Self-host the facilitator for 0% fees — forever.
            </p>
          </div>
        </section>

        {/* Tier Cards */}
        <section className="section-light py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className="relative rounded-2xl p-8"
                  style={{
                    backgroundColor: tier.highlight ? "var(--bg-section-light)" : "var(--bg-section-light-alt)",
                    border: tier.highlight ? "2px solid #50AF95" : "1px solid var(--border-light)",
                  }}
                >
                  {tier.highlight && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                    >
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold" style={{ color: "var(--text-on-light)" }}>
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-on-light-tertiary)" }}>
                    {tier.description}
                  </p>
                  <div className="mt-6">
                    <span className="text-4xl font-bold" style={{ color: "var(--text-on-light)" }}>
                      {tier.price}
                    </span>
                    <span className="ml-1 text-sm" style={{ color: "var(--text-on-light-tertiary)" }}>
                      {tier.period}
                    </span>
                  </div>
                  <ul className="mt-8 space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-on-light-secondary)" }}>
                        <CheckIcon />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={tier.ctaHref}
                    className="mt-8 block w-full rounded-xl py-3 text-center text-sm font-medium transition-all duration-300"
                    style={{
                      backgroundColor: tier.highlight ? "#50AF95" : "var(--bg-section-light-alt)",
                      color: tier.highlight ? "#0A0A0B" : "var(--text-on-light)",
                      border: tier.highlight ? "none" : "1px solid var(--border-light)",
                    }}
                  >
                    {tier.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fee Comparison */}
        <section className="section-dark py-24">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold" style={{ color: "#FAFAFA" }}>
              How we compare
            </h2>
            <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#111113" }}>
                    <th className="px-6 py-4 text-left text-sm font-medium" style={{ color: "#A1A1AA" }}>Provider</th>
                    <th className="px-6 py-4 text-right text-sm font-medium" style={{ color: "#A1A1AA" }}>Fee</th>
                    <th className="px-6 py-4 text-right text-sm font-medium" style={{ color: "#A1A1AA" }}>vs t402</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row) => (
                    <tr
                      key={row.provider}
                      style={{
                        backgroundColor: row.highlight ? "rgba(80,175,149,0.05)" : "transparent",
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-medium" style={{ color: row.highlight ? "#50AF95" : "#FAFAFA" }}>
                        {row.provider}
                      </td>
                      <td className="px-6 py-4 text-right text-sm" style={{ color: row.highlight ? "#50AF95" : "#A1A1AA" }}>
                        {row.fee}
                      </td>
                      <td className="px-6 py-4 text-right text-sm" style={{ color: row.highlight ? "#50AF95" : "#71717A" }}>
                        {row.savings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-center text-sm" style={{ color: "#71717A" }}>
              Self-host your own facilitator for 0% fees.{" "}
              <Link href="https://docs.t402.io" className="underline" style={{ color: "#50AF95" }}>
                Learn how
              </Link>
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="section-light py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold" style={{ color: "var(--text-on-light)" }}>
              Start accepting USDT payments in 5 minutes
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "var(--text-on-light-secondary)" }}>
              No credit card. No KYC. No minimum commitment.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="https://facilitator.t402.io/register"
                className="rounded-xl px-8 py-3 text-sm font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                Get Free API Key
              </Link>
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                className="rounded-xl px-8 py-3 text-sm font-medium"
                style={{ border: "1px solid var(--border-light)", color: "var(--text-on-light)" }}
              >
                View Quickstart
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
