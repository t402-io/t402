import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Pricing | t402",
  description:
    "The t402 protocol is open-source under Apache 2.0 — always free. For managed checkout, billing, and hosted facilitator see t402 Pay at pay.t402.io.",
  openGraph: {
    title: "t402 Pricing — Free Open Protocol + t402 Pay Service",
    description:
      "Apache 2.0 protocol, free forever. Self-host the facilitator at 0% fees. Need managed checkout? See pay.t402.io.",
  },
};

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" style={{ color: "#50AF95" }}>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

const protocolFeatures = [
  "Full protocol specification — schemes, transports, extensions",
  "Reference SDKs in TypeScript, Go, Python, Java",
  "Self-host the facilitator (Apache 2.0 Go binary)",
  "All 47 networks supported",
  "Run unlimited transactions — no SaaS quota",
  "Community-driven on GitHub",
];

const payFeatures = [
  "Hosted facilitator — no infrastructure to run",
  "Merchant dashboard for transactions, refunds, payouts",
  "Hosted invoice pages + embedded checkout widget",
  "Subscription billing primitives",
  "Webhooks with retry + replay protection",
  "Coinbase Commerce migration path",
];

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
              Open protocol. Optional managed service.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              The t402 protocol is open-source under Apache 2.0 — always free. If you want
              managed checkout, billing, and hosted facilitator infrastructure, t402 Pay is
              the commercial sibling service.
            </p>
          </div>
        </section>

        {/* Two cards: protocol vs service */}
        <section className="section-light py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Card 1: Open protocol */}
              <div
                className="relative rounded-2xl p-8"
                style={{
                  backgroundColor: "var(--bg-section-light)",
                  border: "2px solid #50AF95",
                }}
              >
                <div
                  className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                >
                  Open source
                </div>
                <h2 className="text-2xl font-semibold" style={{ color: "var(--text-on-light)" }}>
                  t402 Protocol
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--text-on-light-tertiary)" }}>
                  Apache 2.0 — free forever
                </p>
                <div className="mt-6">
                  <span className="text-5xl font-bold" style={{ color: "var(--text-on-light)" }}>
                    $0
                  </span>
                  <span className="ml-2 text-sm" style={{ color: "var(--text-on-light-tertiary)" }}>
                    no quota, no fee
                  </span>
                </div>
                <ul className="mt-8 space-y-3">
                  {protocolFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-on-light-secondary)" }}>
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="https://docs.t402.io/getting-started/quickstart"
                  className="mt-8 block w-full rounded-xl py-3 text-center text-sm font-medium transition-all duration-300"
                  style={{
                    backgroundColor: "#50AF95",
                    color: "#0A0A0B",
                  }}
                >
                  Start with the docs
                </Link>
              </div>

              {/* Card 2: t402 Pay */}
              <div
                className="relative rounded-2xl p-8"
                style={{
                  backgroundColor: "var(--bg-section-light-alt)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <div
                  className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: "#A1A1AA", color: "#0A0A0B" }}
                >
                  Managed service
                </div>
                <h2 className="text-2xl font-semibold" style={{ color: "var(--text-on-light)" }}>
                  t402 Pay
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--text-on-light-tertiary)" }}>
                  Hosted checkout, billing, and facilitator
                </p>
                <div className="mt-6">
                  <span className="text-2xl font-medium" style={{ color: "var(--text-on-light)" }}>
                    See pricing at{" "}
                    <span style={{ color: "#50AF95" }}>pay.t402.io</span>
                  </span>
                </div>
                <ul className="mt-8 space-y-3">
                  {payFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-on-light-secondary)" }}>
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="https://pay.t402.io"
                  className="mt-8 block w-full rounded-xl py-3 text-center text-sm font-medium transition-all duration-300"
                  style={{
                    backgroundColor: "var(--bg-section-light)",
                    color: "var(--text-on-light)",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  Visit t402 Pay
                </Link>
              </div>
            </div>

            <p className="mt-12 text-center text-sm" style={{ color: "var(--text-on-light-tertiary)" }}>
              The protocol and the service are independent. You can self-host the facilitator
              for 0% fees and never touch t402 Pay — both paths are fully supported.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="section-dark py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold" style={{ color: "#FAFAFA" }}>
              Ready to add t402 to your service?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "#A1A1AA" }}>
              The 10-minute quickstart covers signing, settlement, and your first payment
              on testnet.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                className="rounded-xl px-8 py-3 text-sm font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                Read the quickstart
              </Link>
              <Link
                href="https://github.com/t402-io/t402"
                className="rounded-xl px-8 py-3 text-sm font-medium"
                style={{ border: "1px solid rgba(255, 255, 255, 0.12)", color: "#FAFAFA" }}
              >
                View on GitHub
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
