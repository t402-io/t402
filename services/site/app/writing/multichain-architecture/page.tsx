import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

const pageTitle = "How T402 Achieves Multi-Chain Payment Settlement";
const pageDescription =
  "A deep dive into the architecture behind T402's support for 28 blockchains across 10 families. Learn how CAIP-2 identifiers, scheme-network separation, and the facilitator pattern enable true multi-chain payments.";

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

export default function MultichainArchitecturePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <div className="flex-1">
        <article className="pb-20">
          <header className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-16 md:pt-20">
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Architecture
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Multi-Chain
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Deep Dive
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              How T402 Achieves Multi-Chain Payment Settlement
            </h1>
            <p className="text-base text-foreground-tertiary mb-2">January 18, 2026</p>
            <p className="text-base text-foreground-tertiary mb-8">By: T402 Team</p>
          </header>

          <section className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 space-y-8">
            {/* TL;DR */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-base leading-relaxed text-foreground-secondary">
                <strong className="text-foreground">TL;DR</strong>: T402 separates payment logic into three layers — transport (HTTP, MCP, A2A), scheme (exact, upto), and network (EVM, Solana, TON, etc.) — allowing any combination to work together. CAIP-2 chain identifiers provide universal addressing, while the facilitator pattern keeps chain-specific logic out of application code.
              </p>
            </div>

            {/* The Challenge */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">The Multi-Chain Challenge</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Supporting 28 blockchains isn&apos;t just about writing 28 integrations. Each chain has its own transaction format, signing algorithm, token standard, and finality model. A naive approach would create an exponential matrix of complexity — every transport times every scheme times every chain.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 solves this through strict separation of concerns. The protocol defines clear interfaces at each layer, so adding a new chain doesn&apos;t require changes to the transport or scheme layers.
              </p>
            </section>

            {/* Three Layer Architecture */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Three-Layer Architecture</h2>

              <div className="rounded-xl border border-border bg-background-tertiary p-6 font-mono text-sm overflow-x-auto">
                <pre className="text-foreground-secondary">{`┌─────────────────────────────────────────────┐
│  Transport Layer (HTTP, MCP, A2A)           │
│  How data is exchanged                      │
├─────────────────────────────────────────────┤
│  Scheme Layer (exact, upto)                 │
│  Payment logic and authorization rules      │
├─────────────────────────────────────────────┤
│  Network Layer (EVM, Solana, TON, TRON...)  │
│  Chain-specific signing and settlement      │
└─────────────────────────────────────────────┘`}</pre>
              </div>

              <h3 className="text-lg font-medium text-foreground mt-6">Transport Layer</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Defines how payment requirements and authorizations are exchanged. HTTP uses the 402 status code and X-Payment header. MCP uses JSON-RPC tool invocations. A2A uses task-based flows. The transport layer is completely chain-agnostic.
              </p>

              <h3 className="text-lg font-medium text-foreground mt-6">Scheme Layer</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Defines the payment logic. The <code>exact</code> scheme authorizes a precise amount transfer. The <code>upto</code> scheme authorizes up to a maximum, enabling streaming and metered payments. Schemes define what authorization means, not how it&apos;s implemented on-chain.
              </p>

              <h3 className="text-lg font-medium text-foreground mt-6">Network Layer</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Implements chain-specific operations. For EVM, this means EIP-3009 TransferWithAuthorization signatures. For Solana, SPL token transfer instructions. For TON, Jetton transfer messages. Each mechanism implements the same interface with chain-native primitives.
              </p>
            </section>

            {/* CAIP-2 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Universal Chain Addressing with CAIP-2</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Every blockchain in T402 is identified by a{" "}
                <Link href="https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
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
                  <div key={id} className="flex items-center gap-3 rounded-lg border border-border bg-background-secondary px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{chain}</span>
                    <code className="ml-auto text-xs text-foreground-tertiary">{id}</code>
                  </div>
                ))}
              </div>

              <p className="text-base leading-relaxed text-foreground-secondary">
                This means a 402 response can offer multiple payment options across different chains, and the client simply picks the one it supports. No chain-specific logic needed in the HTTP layer.
              </p>
            </section>

            {/* The Facilitator Pattern */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">The Facilitator Pattern</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The facilitator is the bridge between off-chain authorization and on-chain settlement. It&apos;s responsible for:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Verification</strong>: Validates that payment signatures are cryptographically correct and parameters match requirements</li>
                <li><strong className="text-foreground">Settlement</strong>: Submits the on-chain transaction using the authorized transfer</li>
                <li><strong className="text-foreground">Multi-chain routing</strong>: Maintains wallets and RPC connections for all supported networks</li>
              </ul>

              <div className="rounded-xl border border-border bg-background-tertiary p-6 font-mono text-sm overflow-x-auto">
                <pre className="text-foreground-secondary">{`Client                Server               Facilitator
  │                     │                      │
  │─── GET /resource ──▶│                      │
  │◀── 402 + accepts ───│                      │
  │                     │                      │
  │ (sign off-chain)    │                      │
  │                     │                      │
  │── GET + X-Payment ─▶│                      │
  │                     │─── POST /verify ────▶│
  │                     │◀── { valid: true } ──│
  │                     │─── POST /settle ────▶│
  │                     │◀── { txHash: "..." }─│
  │◀── 200 + resource ──│                      │`}</pre>
              </div>

              <p className="text-base leading-relaxed text-foreground-secondary">
                Servers never need to know chain-specific details. They send the payment payload to the facilitator and get back a verification result. This keeps server implementations simple regardless of how many chains are supported.
              </p>
            </section>

            {/* Mechanism Interface */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">The Mechanism Interface</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Every chain mechanism implements three roles:
              </p>

              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm">
                <p className="text-foreground-tertiary">// TypeScript — Each mechanism exports three constructors</p>
                <p className="text-foreground">import {"{"} ExactEvmClient {"}"} from &apos;@t402/evm/exact/client&apos;;</p>
                <p className="text-foreground">import {"{"} ExactEvmServer {"}"} from &apos;@t402/evm/exact/server&apos;;</p>
                <p className="text-foreground">import {"{"} ExactEvmFacilitator {"}"} from &apos;@t402/evm/exact/facilitator&apos;;</p>
              </div>

              <p className="text-base leading-relaxed text-foreground-secondary">
                The <strong className="text-foreground">Client</strong> knows how to sign payment authorizations. The <strong className="text-foreground">Server</strong> knows how to enhance payment requirements with chain-specific data. The <strong className="text-foreground">Facilitator</strong> knows how to verify signatures and execute settlements. This three-role pattern is consistent across all 10 blockchain families.
              </p>
            </section>

            {/* Adding a New Chain */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Adding a New Chain</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Adding a new blockchain to T402 requires implementing only the mechanism interface for that chain. The process is:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Define the CAIP-2 network identifier</li>
                <li>Implement the client (signature creation)</li>
                <li>Implement the server (requirement enhancement)</li>
                <li>Implement the facilitator (verification + settlement)</li>
                <li>Register the mechanism in the facilitator&apos;s supported list</li>
              </ol>
              <p className="text-base leading-relaxed text-foreground-secondary">
                No changes to the HTTP transport, the scheme logic, or existing mechanisms are required. This is how T402 scaled from 1 chain to 28 chains without protocol changes.
              </p>
            </section>

            {/* Get Started */}
            <section className="mt-12 rounded-2xl border border-border bg-background-secondary p-8 text-center">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Build Multi-Chain Payments</h2>
              <p className="mx-auto mb-6 max-w-xl text-foreground-secondary">
                Start accepting payments on any supported chain with the T402 SDK.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/getting-started/quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
                  style={{ color: "#0A0A0B" }}
                >
                  Get Started
                </Link>
                <Link
                  href="/chains"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
                >
                  View Supported Chains
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
