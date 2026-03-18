import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import { Mermaid } from "../../components/Mermaid";

const pageTitle = "How T402 Achieves Multi-Chain Payment Settlement";
const pageDescription =
  "A deep dive into the architecture behind T402's support for 47 networks across 13 families. Learn how CAIP-2 identifiers, scheme-network separation, and the facilitator pattern enable true multi-chain payments.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/writing/multichain-architecture",
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
  datePublished: "2026-01-18",
  author: { "@type": "Organization", name: "T402 Team", url: "https://t402.io" },
  publisher: { "@type": "Organization", name: "T402", url: "https://t402.io" },
  url: "https://t402.io/writing/multichain-architecture",
  keywords: ["Architecture", "Multi-Chain", "CAIP-2", "Facilitator"],
};

export default function MultichainArchitecturePage() {
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
                {["Architecture", "Multi-Chain", "Deep Dive"].map((tag) => (
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
                How T402 Achieves Multi-Chain Payment Settlement
              </h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: "#A1A1AA" }}>
                <span>January 18, 2026</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <span>T402 Team</span>
              </div>
            </div>
          </header>

          {/* Light Article Body */}
          <section style={{ backgroundColor: "#F7FAF9" }} className="py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 space-y-10" style={{ lineHeight: "1.8" }}>
              {/* TL;DR */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-base" style={{ color: "#4A5568" }}>
                  <strong style={{ color: "#1A1A2E" }}>TL;DR</strong>: T402 separates payment logic into three layers — transport (HTTP, MCP, A2A), scheme (exact, upto), and network (EVM, Solana, TON, etc.) — allowing any combination to work together. CAIP-2 chain identifiers provide universal addressing, while the facilitator pattern keeps chain-specific logic out of application code.
                </p>
              </div>

              {/* The Challenge */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>The Multi-Chain Challenge</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Supporting 47 networks isn&apos;t just about writing separate integrations for each chain. Each chain has its own transaction format, signing algorithm, token standard, and finality model. A naive approach would create an exponential matrix of complexity — every transport times every scheme times every chain.
                </p>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 solves this through strict separation of concerns. The protocol defines clear interfaces at each layer, so adding a new chain doesn&apos;t require changes to the transport or scheme layers.
                </p>
              </section>

              {/* Three Layer Architecture */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Three-Layer Architecture</h2>
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#111113" }}>
                  {[
                    {
                      title: "Transport Layer",
                      desc: "How data is exchanged",
                      items: ["HTTP", "MCP", "A2A"],
                      opacity: 0.18,
                    },
                    {
                      title: "Scheme Layer",
                      desc: "Payment logic and authorization rules",
                      items: ["exact", "upto"],
                      opacity: 0.12,
                    },
                    {
                      title: "Network Layer",
                      desc: "Chain-specific signing and settlement",
                      items: ["EVM", "Solana", "TON", "TRON", "..."],
                      opacity: 0.06,
                    },
                  ].map((layer, i) => (
                    <div
                      key={layer.title}
                      className="px-6 py-5"
                      style={{
                        backgroundColor: `rgba(80,175,149,${layer.opacity})`,
                        borderTop: i > 0 ? "1px solid rgba(80,175,149,0.2)" : undefined,
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-4 mb-2">
                        <span className="text-sm font-semibold" style={{ color: "#FAFAFA" }}>
                          {layer.title}
                        </span>
                        <span className="text-xs" style={{ color: "#A1A1AA" }}>
                          {layer.desc}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {layer.items.map((item) => (
                          <span
                            key={item}
                            className="rounded-md px-2.5 py-1 text-xs font-mono"
                            style={{
                              backgroundColor: "rgba(80,175,149,0.12)",
                              color: "#50AF95",
                              border: "1px solid rgba(80,175,149,0.25)",
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div
                    className="px-6 py-2.5 text-center text-xs font-mono"
                    style={{ color: "#A1A1AA", borderTop: "1px solid rgba(80,175,149,0.15)" }}
                  >
                    ↕ Any transport × any scheme × any network
                  </div>
                </div>

                <h3 className="text-lg font-medium mt-6" style={{ color: "#1A1A2E" }}>Transport Layer</h3>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Defines how payment requirements and authorizations are exchanged. HTTP uses the 402 status code and X-Payment header. MCP uses JSON-RPC tool invocations. A2A uses task-based flows. The transport layer is completely chain-agnostic.
                </p>

                <h3 className="text-lg font-medium mt-6" style={{ color: "#1A1A2E" }}>Scheme Layer</h3>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Defines the payment logic. The <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>exact</code> scheme authorizes a precise amount transfer. The <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>upto</code> scheme authorizes up to a maximum, enabling streaming and metered payments. Schemes define what authorization means, not how it&apos;s implemented on-chain.
                </p>

                <h3 className="text-lg font-medium mt-6" style={{ color: "#1A1A2E" }}>Network Layer</h3>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Implements chain-specific operations. For EVM, this means EIP-3009 TransferWithAuthorization signatures. For Solana, SPL token transfer instructions. For TON, Jetton transfer messages. Each mechanism implements the same interface with chain-native primitives.
                </p>
              </section>

              {/* CAIP-2 */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Universal Chain Addressing with CAIP-2</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Every blockchain in T402 is identified by a{" "}
                  <Link href="https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md" target="_blank" rel="noopener noreferrer" style={{ color: "#50AF95" }} className="hover:opacity-80">
                    CAIP-2
                  </Link>{" "}
                  chain ID — a namespace:reference pair that universally identifies any blockchain:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { chain: "Ethereum", id: "eip155:1" },
                    { chain: "Base", id: "eip155:8453" },
                    { chain: "Arbitrum", id: "eip155:42161" },
                    { chain: "Solana", id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" },
                    { chain: "TON", id: "ton:mainnet" },
                    { chain: "TRON", id: "tron:mainnet" },
                    { chain: "NEAR", id: "near:mainnet" },
                    { chain: "Stacks", id: "stacks:1" },
                  ].map(({ chain, id }) => (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 min-w-0"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      <span className="shrink-0 text-sm font-medium" style={{ color: "#1A1A2E" }}>{chain}</span>
                      <code className="ml-auto truncate text-xs font-mono" style={{ color: "#A1A1AA" }}>{id}</code>
                    </div>
                  ))}
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  This means a 402 response can offer multiple payment options across different chains, and the client simply picks the one it supports. No chain-specific logic needed in the HTTP layer.
                </p>
              </section>

              {/* The Facilitator Pattern */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>The Facilitator Pattern</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  The facilitator is the bridge between off-chain authorization and on-chain settlement. It&apos;s responsible for:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li><strong style={{ color: "#1A1A2E" }}>Verification</strong>: Validates that payment signatures are cryptographically correct and parameters match requirements</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Settlement</strong>: Submits the on-chain transaction using the authorized transfer</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Multi-chain routing</strong>: Maintains wallets and RPC connections for all supported networks</li>
                </ul>
                <Mermaid chart={`
sequenceDiagram
  participant Client
  participant Server
  participant Facilitator

  Client->>Server: GET /resource
  Server-->>Client: 402 + accepts

  Note over Client: Sign off-chain

  Client->>Server: GET + X-Payment
  Server->>Facilitator: POST /verify
  Facilitator-->>Server: { valid: true }
  Server->>Facilitator: POST /settle
  Facilitator-->>Server: { txHash: "..." }
  Server-->>Client: 200 + resource
`} />
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Servers never need to know chain-specific details. They send the payment payload to the facilitator and get back a verification result. This keeps server implementations simple regardless of how many chains are supported.
                </p>
              </section>

              {/* Mechanism Interface */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>The Mechanism Interface</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Every chain mechanism implements three roles:
                </p>
                <div
                  className="rounded-xl p-4 font-mono text-sm"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// TypeScript — Each mechanism exports three constructors</p>
                  <p>import {"{"} ExactEvmClient {"}"} from &apos;@t402/evm/exact/client&apos;;</p>
                  <p>import {"{"} ExactEvmServer {"}"} from &apos;@t402/evm/exact/server&apos;;</p>
                  <p>import {"{"} ExactEvmFacilitator {"}"} from &apos;@t402/evm/exact/facilitator&apos;;</p>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  The <strong style={{ color: "#1A1A2E" }}>Client</strong> knows how to sign payment authorizations. The <strong style={{ color: "#1A1A2E" }}>Server</strong> knows how to enhance payment requirements with chain-specific data. The <strong style={{ color: "#1A1A2E" }}>Facilitator</strong> knows how to verify signatures and execute settlements. This three-role pattern is consistent across all 13 blockchain families.
                </p>
              </section>

              {/* Adding a New Chain */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Adding a New Chain</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Adding a new blockchain to T402 requires implementing only the mechanism interface for that chain. The process is:
                </p>
                <ol className="list-decimal pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li>Define the CAIP-2 network identifier</li>
                  <li>Implement the client (signature creation)</li>
                  <li>Implement the server (requirement enhancement)</li>
                  <li>Implement the facilitator (verification + settlement)</li>
                  <li>Register the mechanism in the facilitator&apos;s supported list</li>
                </ol>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  No changes to the HTTP transport, the scheme logic, or existing mechanisms are required. This is how T402 scaled from 1 chain to 47 networks without protocol changes.
                </p>
              </section>
            </div>
          </section>

          {/* CTA */}
          <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
                Build Multi-Chain Payments
              </h2>
              <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
                Start accepting payments on any supported chain with the T402 SDK.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/getting-started/quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                >
                  Get Started
                </Link>
                <Link
                  href="/chains"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  View Supported Chains
                </Link>
              </div>
            </div>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
