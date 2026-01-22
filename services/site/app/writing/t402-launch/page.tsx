import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

const pageTitle = "Introducing T402: The Official Payment Protocol for USDT";
const pageDescription =
  "T402 brings HTTP-native stablecoin payments to the internet. Zero fees, instant settlement, and support for 10 blockchain networks.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/writing/t402-launch",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function T402LaunchPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <div className="flex-1">
        <article className="pb-20">
          {/* Header */}
          <header className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-16 md:pt-20">
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Protocol
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Launch
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Announcement
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              Introducing T402: The Official Payment Protocol for USDT
            </h1>
            <p className="text-base text-foreground-tertiary mb-2">January 15, 2026</p>
            <p className="text-base text-foreground-tertiary mb-8">By: T402 Team</p>
          </header>

          {/* Hero Section */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 mb-12">
            <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand/20 to-background-secondary p-8 sm:p-12">
              <div className="text-center">
                <span className="text-6xl sm:text-8xl font-bold text-brand">T402</span>
                <p className="mt-4 text-xl text-foreground-secondary">
                  HTTP-native stablecoin payments for the internet
                </p>
              </div>
            </div>
          </div>

          {/* Article Body */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 space-y-8">
            {/* TL;DR */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-base leading-relaxed text-foreground-secondary">
                <strong className="text-foreground">TL;DR</strong>: T402 is an open-source payment protocol that embeds USDT payments directly into HTTP. It supports 10 blockchain networks, offers zero transaction fees, instant settlement, and is designed for both human users and AI agents. Start accepting payments in minutes with our production-ready SDKs.
              </p>
            </div>

            {/* What is T402 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">What is T402?</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 is the official payment protocol for USDT stablecoins. It leverages the long-dormant HTTP 402 &quot;Payment Required&quot; status code to enable native web payments without intermediaries.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                When a client requests a paid resource, the server responds with a 402 status code and payment requirements. The client signs a transaction, includes it in the request headers, and the server verifies payment before delivering the resource. Simple, secure, and instant.
              </p>
            </section>

            {/* Key Features */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Key Features</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-4">
                  <CheckIcon className="mt-0.5 text-brand flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Zero Transaction Fees</p>
                    <p className="text-sm text-foreground-tertiary">No percentage cuts, no flat fees. Keep 100% of your earnings.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-4">
                  <CheckIcon className="mt-0.5 text-brand flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Instant Settlement</p>
                    <p className="text-sm text-foreground-tertiary">Funds are available immediately. No waiting days for payouts.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-4">
                  <CheckIcon className="mt-0.5 text-brand flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">10 Blockchain Networks</p>
                    <p className="text-sm text-foreground-tertiary">Ethereum, Base, Arbitrum, Polygon, Ink, Berachain, Unichain, TON, TRON, and Solana.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-4">
                  <CheckIcon className="mt-0.5 text-brand flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Gasless Transactions</p>
                    <p className="text-sm text-foreground-tertiary">Users don&apos;t need native tokens. Pay transaction fees with USDT.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-4">
                  <CheckIcon className="mt-0.5 text-brand flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">AI Agent Ready</p>
                    <p className="text-sm text-foreground-tertiary">Native MCP integration for autonomous AI agent payments.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-4">
                  <CheckIcon className="mt-0.5 text-brand flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Open Source</p>
                    <p className="text-sm text-foreground-tertiary">Fully auditable code. MIT licensed. Build with confidence.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Supported Chains */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Supported Networks</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 supports payments across 10 blockchain networks, spanning both EVM and non-EVM ecosystems:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {["Ethereum", "Base", "Arbitrum", "Polygon", "Ink", "Berachain", "Unichain", "TON", "TRON", "Solana"].map((chain) => (
                  <div key={chain} className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-center text-sm font-medium">
                    {chain}
                  </div>
                ))}
              </div>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Each network is optimized for different use cases. EVM chains support gasless transactions via EIP-3009, while TON offers deep Telegram integration for social payments.
              </p>
            </section>

            {/* SDKs */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Production-Ready SDKs</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Get started in minutes with our official SDKs for TypeScript, Python, Go, and Java:
              </p>
              <div className="rounded-xl border border-border bg-background-tertiary overflow-hidden">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
                  <div className="p-4 text-center">
                    <p className="font-mono text-sm text-foreground-tertiary">TypeScript</p>
                    <p className="font-semibold text-foreground">v2.3.0</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="font-mono text-sm text-foreground-tertiary">Python</p>
                    <p className="font-semibold text-foreground">v1.9.0</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="font-mono text-sm text-foreground-tertiary">Go</p>
                    <p className="font-semibold text-foreground">v1.8.0</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="font-mono text-sm text-foreground-tertiary">Java</p>
                    <p className="font-semibold text-foreground">v1.7.0</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm">
                <p className="text-foreground-tertiary"># Install the TypeScript SDK</p>
                <p className="text-foreground">npm install @t402/core @t402/schemes</p>
              </div>
            </section>

            {/* Use Cases */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Built For</h2>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">API Monetization</strong>: Charge per API call without payment processor accounts or KYC requirements.</li>
                <li><strong className="text-foreground">AI Agents</strong>: Enable autonomous agents to pay for compute, data, and services programmatically.</li>
                <li><strong className="text-foreground">Content Creators</strong>: Monetize digital content with pay-per-view or pay-per-download models.</li>
                <li><strong className="text-foreground">Global Services</strong>: Accept payments from anywhere without banking restrictions.</li>
                <li><strong className="text-foreground">Marketplaces</strong>: Dynamic payment routing for multi-vendor platforms with instant settlement.</li>
              </ul>
            </section>

            {/* Get Started */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Get Started</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 is open source and free to use. Start accepting stablecoin payments today:
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/sdks"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
                  style={{ color: "#0A0A0B" }}
                >
                  View SDKs
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="https://docs.t402.io/quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
                >
                  Read Documentation
                </Link>
                <Link
                  href="https://github.com/t402-io/t402"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
                >
                  GitHub
                </Link>
              </div>
            </section>

            {/* Community */}
            <section className="mt-12 rounded-2xl border border-border bg-background-secondary p-8 text-center">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Join the Community</h2>
              <p className="mx-auto mb-6 max-w-xl text-foreground-secondary">
                Connect with other developers building on T402. Get help, share ideas, and stay updated on the latest developments.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://t.me/t402_community"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
                  style={{ color: "#0A0A0B" }}
                >
                  Join Telegram
                </Link>
              </div>
            </section>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
