import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

const pageTitle = "Introducing T402: The Official Payment Protocol for USDT";
const pageDescription =
  "T402 brings HTTP-native stablecoin payments to the internet. Zero fees, instant settlement, and support for 47 networks across 13 families.";

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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: pageTitle,
  description: pageDescription,
  datePublished: "2026-01-15",
  author: { "@type": "Organization", name: "T402 Team", url: "https://t402.io" },
  publisher: { "@type": "Organization", name: "T402", url: "https://t402.io" },
  url: "https://t402.io/writing/t402-launch",
  keywords: ["Protocol", "Launch", "Announcement", "USDT", "Stablecoin"],
};

function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
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
      style={style}
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0A0A0B", color: "#FAFAFA" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar />

      <div className="flex-1">
        <article>
          {/* Dark Header */}
          <header className="py-24 md:py-32" style={{ backgroundColor: "#0A0A0B" }}>
            <div className="max-w-3xl mx-auto px-6">
              <div className="mb-6 flex flex-wrap gap-2">
                {["Protocol", "Launch", "Announcement"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-6"
                style={{ color: "#FAFAFA" }}
              >
                Introducing T402: The Official Payment Protocol for USDT
              </h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: "#A1A1AA" }}>
                <span>January 15, 2026</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <span>T402 Team</span>
              </div>
            </div>
          </header>

          {/* Hero Banner */}
          <div style={{ backgroundColor: "#F7FAF9" }} className="pt-16 pb-0">
            <div className="max-w-3xl mx-auto px-6">
              <div
                className="relative w-full overflow-hidden rounded-2xl p-8 sm:p-12"
                style={{
                  background: "linear-gradient(135deg, rgba(80,175,149,0.15), rgba(80,175,149,0.05))",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <div className="text-center">
                  <span className="text-6xl sm:text-8xl font-bold" style={{ color: "#50AF95" }}>T402</span>
                  <p className="mt-4 text-xl" style={{ color: "#4A5568" }}>
                    HTTP-native stablecoin payments for the internet
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Light Article Body */}
          <section style={{ backgroundColor: "#F7FAF9" }} className="py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 space-y-10" style={{ lineHeight: "1.8" }}>
              {/* TL;DR */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-base" style={{ color: "#4A5568" }}>
                  <strong style={{ color: "#1A1A2E" }}>TL;DR</strong>: T402 is an open-source payment protocol that embeds USDT payments directly into HTTP. It supports 47 networks across 13 families, offers zero transaction fees, instant settlement, and is designed for both human users and AI agents. Start accepting payments in minutes with our production-ready SDKs.
                </p>
              </div>

              {/* What is T402 */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>What is T402?</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 is the official payment protocol for USDT stablecoins. It leverages the long-dormant HTTP 402 &quot;Payment Required&quot; status code to enable native web payments without intermediaries.
                </p>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  When a client requests a paid resource, the server responds with a 402 status code and payment requirements. The client signs a transaction, includes it in the request headers, and the server verifies payment before delivering the resource. Simple, secure, and instant.
                </p>
              </section>

              {/* Key Features */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Key Features</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { title: "Zero Transaction Fees", desc: "No percentage cuts, no flat fees. Keep 100% of your earnings." },
                    { title: "Instant Settlement", desc: "Funds are available immediately. No waiting days for payouts." },
                    { title: "47 Networks", desc: "EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, and Cosmos across 13 blockchain families." },
                    { title: "Gasless Transactions", desc: "Users don\u2019t need native tokens. Pay transaction fees with USDT." },
                    { title: "AI Agent Ready", desc: "Native MCP integration for autonomous AI agent payments." },
                    { title: "Open Source", desc: "Fully auditable code. MIT licensed. Build with confidence." },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 rounded-2xl p-4"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      <CheckIcon className="mt-0.5 flex-shrink-0" style={{ color: "#50AF95" } as React.CSSProperties} />
                      <div>
                        <p className="font-medium" style={{ color: "#1A1A2E" }}>{item.title}</p>
                        <p className="text-sm mt-1" style={{ color: "#A1A1AA" }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Supported Chains */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Supported Networks</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 supports payments across 47 networks, spanning 13 blockchain families:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {["Ethereum", "Base", "Arbitrum", "Optimism", "Solana", "TON", "TRON", "NEAR", "Aptos", "Tezos", "Polkadot", "Stacks", "Mantle", "Ink", "Berachain"].map((chain) => (
                    <div
                      key={chain}
                      className="rounded-xl px-3 py-2 text-center text-sm font-medium"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A2E" }}
                    >
                      {chain}
                    </div>
                  ))}
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Each network is optimized for different use cases. EVM chains support gasless transactions via EIP-3009, while TON offers deep Telegram integration for social payments.
                </p>
              </section>

              {/* SDKs */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Production-Ready SDKs</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Get started in minutes with our official SDKs for TypeScript, Python, Go, and Java:
                </p>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                    {[
                      { lang: "TypeScript", ver: "v2.8.0" },
                      { lang: "Python", ver: "v1.12.1" },
                      { lang: "Go", ver: "v1.12.1" },
                      { lang: "Java", ver: "v1.12.1" },
                    ].map((sdk) => (
                      <div key={sdk.lang} className="p-4 text-center">
                        <p className="font-mono text-sm" style={{ color: "#A1A1AA" }}>{sdk.lang}</p>
                        <p className="font-semibold" style={{ color: "#1A1A2E" }}>{sdk.ver}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="rounded-xl p-4 font-mono text-sm"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}># Install the TypeScript SDK</p>
                  <p>npm install @t402/core @t402/evm</p>
                </div>
              </section>

              {/* Use Cases */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Built For</h2>
                <ul className="list-disc pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li><strong style={{ color: "#1A1A2E" }}>API Monetization</strong>: Charge per API call without payment processor accounts or KYC requirements.</li>
                  <li><strong style={{ color: "#1A1A2E" }}>AI Agents</strong>: Enable autonomous agents to pay for compute, data, and services programmatically.</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Content Creators</strong>: Monetize digital content with pay-per-view or pay-per-download models.</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Global Services</strong>: Accept payments from anywhere without banking restrictions.</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Marketplaces</strong>: Dynamic payment routing for multi-vendor platforms with instant settlement.</li>
                </ul>
              </section>

              {/* Get Started */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Get Started</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 is open source and free to use. Start accepting stablecoin payments today:
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/sdks"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                    style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                  >
                    View SDKs
                    <ArrowRightIcon />
                  </Link>
                  <Link
                    href="https://docs.t402.io/getting-started/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                    style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    Read Documentation
                  </Link>
                  <Link
                    href="https://github.com/t402-io/t402"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                    style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    GitHub
                  </Link>
                </div>
              </section>
            </div>
          </section>

          {/* Community CTA */}
          <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
                Join the Community
              </h2>
              <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
                Connect with other developers building on T402. Get help, share ideas, and stay updated on the latest developments.
              </p>
              <Link
                href="https://t.me/t402_community"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                Join Telegram
              </Link>
            </div>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
