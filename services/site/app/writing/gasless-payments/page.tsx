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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar />

      <div className="flex-1">
        <article className="pb-20">
          <header className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-16 md:pt-20">
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                ERC-4337
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Gasless
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Account Abstraction
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              Gasless Payments with ERC-4337 Account Abstraction
            </h1>
            <p className="text-base text-foreground-tertiary mb-2">January 20, 2026</p>
            <p className="text-base text-foreground-tertiary mb-8">By: T402 Team</p>
          </header>

          <section className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 space-y-8">
            {/* TL;DR */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-base leading-relaxed text-foreground-secondary">
                <strong className="text-foreground">TL;DR</strong>: T402&apos;s gasless mode wraps payment authorizations in ERC-4337 UserOperations, allowing users to pay with USDT without holding ETH for gas. A paymaster sponsors the transaction, and the bundler submits it on-chain. Available on all supported EVM chains via <code>@t402/wdk-gasless</code>.
              </p>
            </div>

            {/* The Gas Problem */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">The Gas Problem</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Traditional EVM payments require users to hold two tokens: the payment token (USDT) and the native gas token (ETH, MATIC, etc.). This creates friction — users who receive USDT can&apos;t spend it without first acquiring gas tokens through an exchange or bridge.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                For mainstream adoption, users should only need to think about the payment amount. They have USDT, they want to pay — everything else should be invisible.
              </p>
            </section>

            {/* ERC-4337 Overview */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">ERC-4337: Account Abstraction</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                ERC-4337 introduces a new transaction flow that separates who initiates a transaction from who pays for gas:
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2">Traditional Transaction</p>
                  <ul className="space-y-1 text-sm text-foreground-tertiary">
                    <li>User signs tx with EOA</li>
                    <li>User pays gas in ETH</li>
                    <li>Submitted directly to mempool</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2">ERC-4337 UserOperation</p>
                  <ul className="space-y-1 text-sm text-foreground-tertiary">
                    <li>User signs a UserOp</li>
                    <li>Paymaster pays gas</li>
                    <li>Bundler submits to EntryPoint</li>
                  </ul>
                </div>
              </div>

              <p className="text-base leading-relaxed text-foreground-secondary">
                Key components:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">UserOperation</strong>: A pseudo-transaction that describes what the user wants to do</li>
                <li><strong className="text-foreground">Bundler</strong>: Collects UserOps and submits them as real transactions</li>
                <li><strong className="text-foreground">Paymaster</strong>: A contract that sponsors gas fees (can be repaid in ERC-20 tokens)</li>
                <li><strong className="text-foreground">EntryPoint</strong>: The singleton contract that validates and executes UserOps</li>
              </ul>
            </section>

            {/* T402 Integration */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">T402 Gasless Flow</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 integrates ERC-4337 through the <code>@t402/wdk-gasless</code> package. The flow wraps a standard EIP-3009 TransferWithAuthorization inside a UserOperation:
              </p>

              <div className="rounded-xl border border-border bg-background-tertiary p-6 font-mono text-sm overflow-x-auto">
                <pre className="text-foreground-secondary">{`1. Client signs EIP-3009 authorization (off-chain, free)
2. Authorization is wrapped in a UserOperation
3. Paymaster agrees to sponsor gas
4. Bundler submits UserOp to EntryPoint contract
5. EntryPoint validates and executes:
   a. Paymaster pays gas
   b. Token transfer executes via transferWithAuthorization
6. USDT moves from payer → payee
7. Gas cost is deducted from paymaster (or charged to user in USDT)`}</pre>
              </div>

              <p className="text-base leading-relaxed text-foreground-secondary">
                The user experience is simple: sign one message, payment complete. No ETH, no gas estimation, no stuck transactions.
              </p>
            </section>

            {/* Code Example */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Implementation</h2>

              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto">
                <p className="text-foreground-tertiary">// Server-side: wrap the facilitator with gasless support</p>
                <p className="text-foreground">import {"{"} withGasless {"}"} from &apos;@t402/wdk-gasless&apos;;</p>
                <p className="text-foreground">import {"{"} ExactEvmFacilitator {"}"} from &apos;@t402/evm/exact/facilitator&apos;;</p>
                <p className="text-foreground mt-2">const facilitator = withGasless(</p>
                <p className="text-foreground">{"  "}new ExactEvmFacilitator({"{"} rpcUrl, signer {"}"}),</p>
                <p className="text-foreground">{"  "}{"{"}</p>
                <p className="text-foreground">{"    "}bundlerUrl: &apos;https://bundler.example.com&apos;,</p>
                <p className="text-foreground">{"    "}paymasterUrl: &apos;https://paymaster.example.com&apos;,</p>
                <p className="text-foreground">{"    "}entryPoint: &apos;0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789&apos;</p>
                <p className="text-foreground">{"  "}{"}"}</p>
                <p className="text-foreground">);</p>
              </div>

              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto mt-4">
                <p className="text-foreground-tertiary">// Client-side: CLI gasless flag</p>
                <p className="text-foreground">t402 pay 0xRecipient... 1.00 --gasless</p>
                <p className="text-foreground">t402 request https://api.example.com/data --gasless</p>
              </div>
            </section>

            {/* Supported Chains */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Supported Chains</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Gasless payments are available on all EVM chains where ERC-4337 infrastructure is deployed:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Ink", "Berachain", "Mantle"].map((chain) => (
                  <div key={chain} className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-center text-sm font-medium">
                    {chain}
                  </div>
                ))}
              </div>
            </section>

            {/* Trade-offs */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Trade-offs</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2 text-brand">Advantages</p>
                  <ul className="space-y-1 text-sm text-foreground-secondary">
                    <li>No ETH needed for users</li>
                    <li>Better UX for non-crypto users</li>
                    <li>Single-token experience</li>
                    <li>Bundler handles nonce management</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2">Considerations</p>
                  <ul className="space-y-1 text-sm text-foreground-secondary">
                    <li>Slightly higher latency (bundler step)</li>
                    <li>Requires paymaster infrastructure</li>
                    <li>UserOp gas estimation can vary</li>
                    <li>EVM-only (other chains use native gasless)</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* CTA */}
            <section className="mt-12 rounded-2xl border border-border bg-background-secondary p-8 text-center">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Try Gasless Payments</h2>
              <p className="mx-auto mb-6 max-w-xl text-foreground-secondary">
                Enable gasless mode in the CLI or integrate <code>@t402/wdk-gasless</code> into your application.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/advanced/gasless"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
                  style={{ color: "#0A0A0B" }}
                >
                  Documentation
                </Link>
                <Link
                  href="https://demo.t402.io/gasless-payment"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
                >
                  Live Demo
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
