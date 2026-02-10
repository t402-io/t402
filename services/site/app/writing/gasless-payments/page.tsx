import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

const pageTitle = "Gasless Payments with ERC-4337 Account Abstraction";
const pageDescription =
  "Users shouldn't need ETH to pay with USDT. Learn how T402 integrates ERC-4337 UserOperations and paymasters to enable gasless stablecoin transfers across EVM chains.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/writing/gasless-payments",
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
  datePublished: "2026-01-20",
  author: { "@type": "Organization", name: "T402 Team", url: "https://t402.io" },
  publisher: { "@type": "Organization", name: "T402", url: "https://t402.io" },
  url: "https://t402.io/writing/gasless-payments",
  keywords: ["ERC-4337", "Gasless", "Account Abstraction", "UserOperations"],
};

export default function GaslessPaymentsPage() {
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
                {["ERC-4337", "Gasless", "Account Abstraction"].map((tag) => (
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
                Gasless Payments with ERC-4337 Account Abstraction
              </h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: "#A1A1AA" }}>
                <span>January 20, 2026</span>
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
                  <strong style={{ color: "#1A1A2E" }}>TL;DR</strong>: T402&apos;s gasless mode wraps payment authorizations in ERC-4337 UserOperations, allowing users to pay with USDT without holding ETH for gas. A paymaster sponsors the transaction, and the bundler submits it on-chain. Available on all supported EVM chains via <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/wdk-gasless</code>.
                </p>
              </div>

              {/* The Gas Problem */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>The Gas Problem</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Traditional EVM payments require users to hold two tokens: the payment token (USDT) and the native gas token (ETH, MATIC, etc.). This creates friction — users who receive USDT can&apos;t spend it without first acquiring gas tokens through an exchange or bridge.
                </p>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  For mainstream adoption, users should only need to think about the payment amount. They have USDT, they want to pay — everything else should be invisible.
                </p>
              </section>

              {/* ERC-4337 Overview */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>ERC-4337: Account Abstraction</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  ERC-4337 introduces a new transaction flow that separates who initiates a transaction from who pays for gas:
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <p className="font-medium mb-2" style={{ color: "#1A1A2E" }}>Traditional Transaction</p>
                    <ul className="space-y-1 text-sm" style={{ color: "#A1A1AA" }}>
                      <li>User signs tx with EOA</li>
                      <li>User pays gas in ETH</li>
                      <li>Submitted directly to mempool</li>
                    </ul>
                  </div>
                  <div
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <p className="font-medium mb-2" style={{ color: "#1A1A2E" }}>ERC-4337 UserOperation</p>
                    <ul className="space-y-1 text-sm" style={{ color: "#A1A1AA" }}>
                      <li>User signs a UserOp</li>
                      <li>Paymaster pays gas</li>
                      <li>Bundler submits to EntryPoint</li>
                    </ul>
                  </div>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Key components:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li><strong style={{ color: "#1A1A2E" }}>UserOperation</strong>: A pseudo-transaction that describes what the user wants to do</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Bundler</strong>: Collects UserOps and submits them as real transactions</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Paymaster</strong>: A contract that sponsors gas fees (can be repaid in ERC-20 tokens)</li>
                  <li><strong style={{ color: "#1A1A2E" }}>EntryPoint</strong>: The singleton contract that validates and executes UserOps</li>
                </ul>
              </section>

              {/* T402 Integration */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>T402 Gasless Flow</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 integrates ERC-4337 through the <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/wdk-gasless</code> package. The flow wraps a standard EIP-3009 TransferWithAuthorization inside a UserOperation:
                </p>
                <div
                  className="rounded-xl p-6 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <pre style={{ color: "#A1A1AA" }}>{`1. Client signs EIP-3009 authorization (off-chain, free)
2. Authorization is wrapped in a UserOperation
3. Paymaster agrees to sponsor gas
4. Bundler submits UserOp to EntryPoint contract
5. EntryPoint validates and executes:
   a. Paymaster pays gas
   b. Token transfer executes via transferWithAuthorization
6. USDT moves from payer → payee
7. Gas cost is deducted from paymaster (or charged to user in USDT)`}</pre>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  The user experience is simple: sign one message, payment complete. No ETH, no gas estimation, no stuck transactions.
                </p>
              </section>

              {/* Code Example */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Implementation</h2>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// Server-side: wrap the facilitator with gasless support</p>
                  <p>import {"{"} withGasless {"}"} from &apos;@t402/wdk-gasless&apos;;</p>
                  <p>import {"{"} ExactEvmFacilitator {"}"} from &apos;@t402/evm/exact/facilitator&apos;;</p>
                  <p className="mt-2">const facilitator = withGasless(</p>
                  <p>{"  "}new ExactEvmFacilitator({"{"} rpcUrl, signer {"}"}),</p>
                  <p>{"  "}{"{"}</p>
                  <p>{"    "}bundlerUrl: &apos;https://bundler.example.com&apos;,</p>
                  <p>{"    "}paymasterUrl: &apos;https://paymaster.example.com&apos;,</p>
                  <p>{"    "}entryPoint: &apos;0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789&apos;</p>
                  <p>{"  "}{"}"}</p>
                  <p>);</p>
                </div>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto mt-4"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// Client-side: CLI gasless flag</p>
                  <p>t402 pay 0xRecipient... 1.00 --gasless</p>
                  <p>t402 request https://api.example.com/data --gasless</p>
                </div>
              </section>

              {/* Supported Chains */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Supported Chains</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Gasless payments are available on all EVM chains where ERC-4337 infrastructure is deployed:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Ink", "Berachain", "Mantle"].map((chain) => (
                    <div
                      key={chain}
                      className="rounded-xl px-3 py-2 text-center text-sm font-medium"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A2E" }}
                    >
                      {chain}
                    </div>
                  ))}
                </div>
              </section>

              {/* Trade-offs */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Trade-offs</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <p className="font-medium mb-2" style={{ color: "#50AF95" }}>Advantages</p>
                    <ul className="space-y-1 text-sm" style={{ color: "#4A5568" }}>
                      <li>No ETH needed for users</li>
                      <li>Better UX for non-crypto users</li>
                      <li>Single-token experience</li>
                      <li>Bundler handles nonce management</li>
                    </ul>
                  </div>
                  <div
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <p className="font-medium mb-2" style={{ color: "#1A1A2E" }}>Considerations</p>
                    <ul className="space-y-1 text-sm" style={{ color: "#4A5568" }}>
                      <li>Slightly higher latency (bundler step)</li>
                      <li>Requires paymaster infrastructure</li>
                      <li>UserOp gas estimation can vary</li>
                      <li>EVM-only (other chains use native gasless)</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </section>

          {/* CTA */}
          <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
                Try Gasless Payments
              </h2>
              <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
                Enable gasless mode in the CLI or integrate <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/wdk-gasless</code> into your application.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/advanced/gasless"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                >
                  Documentation
                </Link>
                <Link
                  href="https://demo.t402.io/gasless-payment"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  Live Demo
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
