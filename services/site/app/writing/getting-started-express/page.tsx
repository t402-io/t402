import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

const pageTitle = "Add Payments to Your Express.js API in 5 Minutes";
const pageDescription =
  "A step-by-step guide to integrating T402 payments into an existing Express.js application. From installation to accepting your first stablecoin payment.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/writing/getting-started-express",
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
  datePublished: "2026-01-23",
  author: { "@type": "Organization", name: "T402 Team", url: "https://t402.io" },
  publisher: { "@type": "Organization", name: "T402", url: "https://t402.io" },
  url: "https://t402.io/writing/getting-started-express",
  keywords: ["Tutorial", "Express.js", "TypeScript", "Getting Started"],
};

export default function GettingStartedExpressPage() {
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
                Tutorial
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Express.js
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                TypeScript
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              Add Payments to Your Express.js API in 5 Minutes
            </h1>
            <p className="text-base text-foreground-tertiary mb-2">January 23, 2026</p>
            <p className="text-base text-foreground-tertiary mb-8">By: T402 Team</p>
          </header>

          <section className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 space-y-8">
            {/* TL;DR */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-base leading-relaxed text-foreground-secondary">
                <strong className="text-foreground">TL;DR</strong>: Install <code>@t402/express</code> and <code>@t402/evm</code>, add the middleware to your route, configure your payment address — done. Your API now returns 402 for unauthorized requests and accepts USDT payments via the X-Payment header.
              </p>
            </div>

            {/* Prerequisites */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Prerequisites</h2>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Node.js 18+ and npm/pnpm</li>
                <li>An existing Express.js application (or create one fresh)</li>
                <li>A wallet address to receive payments (any EVM address)</li>
              </ul>
            </section>

            {/* Step 1: Install */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Step 1: Install Packages</h2>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm">
                <p className="text-foreground">npm install @t402/express @t402/evm @t402/core</p>
              </div>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Three packages: <code>@t402/express</code> provides the middleware, <code>@t402/evm</code> handles EVM chain verification, and <code>@t402/core</code> provides shared types.
              </p>
            </section>

            {/* Step 2: Configure */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Step 2: Configure the Middleware</h2>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto">
                <p className="text-foreground-tertiary">// payment.ts</p>
                <p className="text-foreground">import {"{"} createPaymentMiddleware {"}"} from &apos;@t402/express&apos;;</p>
                <p className="text-foreground">import {"{"} ExactEvmScheme {"}"} from &apos;@t402/evm&apos;;</p>
                <p className="text-foreground mt-2">const scheme = ExactEvmScheme.server({"{"}</p>
                <p className="text-foreground">{"  "}rpcUrl: process.env.RPC_URL || &apos;https://mainnet.base.org&apos;</p>
                <p className="text-foreground">{"}"});</p>
                <p className="text-foreground mt-2">export const paymentMiddleware = createPaymentMiddleware({"{"}</p>
                <p className="text-foreground">{"  "}scheme,</p>
                <p className="text-foreground">{"  "}facilitatorUrl: &apos;https://facilitator.t402.io&apos;,</p>
                <p className="text-foreground">{"  "}defaultRequirements: {"{"}</p>
                <p className="text-foreground">{"    "}scheme: &apos;exact&apos;,</p>
                <p className="text-foreground">{"    "}network: &apos;eip155:8453&apos;,</p>
                <p className="text-foreground">{"    "}payTo: process.env.PAY_TO_ADDRESS!,</p>
                <p className="text-foreground">{"  "}{"}"}</p>
                <p className="text-foreground">{"}"});</p>
              </div>
            </section>

            {/* Step 3: Apply to Routes */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Step 3: Protect Your Routes</h2>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto">
                <p className="text-foreground-tertiary">// app.ts</p>
                <p className="text-foreground">import express from &apos;express&apos;;</p>
                <p className="text-foreground">import {"{"} paymentMiddleware {"}"} from &apos;./payment&apos;;</p>
                <p className="text-foreground mt-2">const app = express();</p>
                <p className="text-foreground mt-2">// Free endpoint — no payment required</p>
                <p className="text-foreground">app.get(&apos;/health&apos;, (req, res) =&gt; {"{"}</p>
                <p className="text-foreground">{"  "}res.json({"{"} status: &apos;ok&apos; {"}"});</p>
                <p className="text-foreground">{"}"});</p>
                <p className="text-foreground mt-2">// Paid endpoint — requires $0.01 USDT</p>
                <p className="text-foreground">app.get(&apos;/api/premium&apos;,</p>
                <p className="text-foreground">{"  "}paymentMiddleware({"{"} amount: &apos;10000&apos; {"}"}), // 0.01 USDT (6 decimals)</p>
                <p className="text-foreground">{"  "}(req, res) =&gt; {"{"}</p>
                <p className="text-foreground">{"    "}res.json({"{"} data: &apos;Premium content here&apos; {"}"});</p>
                <p className="text-foreground">{"  "}{"}"}</p>
                <p className="text-foreground">);</p>
                <p className="text-foreground mt-2">app.listen(3000);</p>
              </div>
              <p className="text-base leading-relaxed text-foreground-secondary">
                That&apos;s it. When a client hits <code>/api/premium</code> without payment, they get a 402 response with payment requirements. When they include a valid X-Payment header, the middleware verifies the payment and calls your handler.
              </p>
            </section>

            {/* Step 4: Test */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Step 4: Test It</h2>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto">
                <p className="text-foreground-tertiary"># Start your server</p>
                <p className="text-foreground">npm run dev</p>
                <p className="text-foreground mt-2 text-foreground-tertiary"># Request without payment → 402</p>
                <p className="text-foreground">curl -s http://localhost:3000/api/premium | jq .</p>
                <p className="text-foreground-tertiary"># {"{"}</p>
                <p className="text-foreground-tertiary">#   &quot;error&quot;: &quot;Payment required&quot;,</p>
                <p className="text-foreground-tertiary">#   &quot;accepts&quot;: [{"{"}&quot;scheme&quot;:&quot;exact&quot;,&quot;network&quot;:&quot;eip155:8453&quot;,...{"}"}]</p>
                <p className="text-foreground-tertiary"># {"}"}</p>
                <p className="text-foreground mt-2 text-foreground-tertiary"># Pay using the T402 CLI</p>
                <p className="text-foreground">t402 request http://localhost:3000/api/premium</p>
                <p className="text-foreground-tertiary"># {"{"}&quot;data&quot;:&quot;Premium content here&quot;{"}"}</p>
              </div>
            </section>

            {/* Per-Route Pricing */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Per-Route Pricing</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Different endpoints can have different prices:
              </p>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto">
                <p className="text-foreground-tertiary">// $0.001 per weather query</p>
                <p className="text-foreground">app.get(&apos;/api/weather&apos;, paymentMiddleware({"{"} amount: &apos;1000&apos; {"}"}), handler);</p>
                <p className="text-foreground mt-2 text-foreground-tertiary">// $0.05 per AI generation</p>
                <p className="text-foreground">app.post(&apos;/api/generate&apos;, paymentMiddleware({"{"} amount: &apos;50000&apos; {"}"}), handler);</p>
                <p className="text-foreground mt-2 text-foreground-tertiary">// $1.00 per premium dataset</p>
                <p className="text-foreground">app.get(&apos;/api/dataset&apos;, paymentMiddleware({"{"} amount: &apos;1000000&apos; {"}"}), handler);</p>
              </div>
            </section>

            {/* Multi-Chain */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Accept Multiple Chains</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Offer clients a choice of payment networks:
              </p>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto">
                <p className="text-foreground">app.get(&apos;/api/data&apos;,</p>
                <p className="text-foreground">{"  "}paymentMiddleware({"{"}</p>
                <p className="text-foreground">{"    "}amount: &apos;10000&apos;,</p>
                <p className="text-foreground">{"    "}accepts: [</p>
                <p className="text-foreground">{"      "}{"{"} network: &apos;eip155:8453&apos; {"}"},{"  "}// Base</p>
                <p className="text-foreground">{"      "}{"{"} network: &apos;eip155:42161&apos; {"}"}, // Arbitrum</p>
                <p className="text-foreground">{"      "}{"{"} network: &apos;eip155:10&apos; {"}"},{"    "}// Optimism</p>
                <p className="text-foreground">{"    "}]</p>
                <p className="text-foreground">{"  "}{"}"});</p>
                <p className="text-foreground">{"  "}handler</p>
                <p className="text-foreground">);</p>
              </div>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The 402 response will include all accepted networks, and the client picks whichever chain they have funds on.
              </p>
            </section>

            {/* Environment Variables */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Environment Variables</h2>
              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm">
                <p className="text-foreground-tertiary"># .env</p>
                <p className="text-foreground">PAY_TO_ADDRESS=0xYourWalletAddress</p>
                <p className="text-foreground">RPC_URL=https://mainnet.base.org</p>
                <p className="text-foreground">FACILITATOR_URL=https://facilitator.t402.io</p>
              </div>
              <p className="text-base leading-relaxed text-foreground-secondary">
                <code>PAY_TO_ADDRESS</code> is where payments are settled. This is your standard EVM wallet address. Funds arrive in USDT on the specified chain.
              </p>
            </section>

            {/* What Happens Under the Hood */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">What Happens Under the Hood</h2>
              <ol className="list-decimal pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Client sends GET without payment → middleware returns 402 with payment requirements in X-Payment header and response body</li>
                <li>Client signs an EIP-3009 TransferWithAuthorization (off-chain, no gas)</li>
                <li>Client retries with the signed payload in the X-Payment header</li>
                <li>Middleware sends the payload to the facilitator for verification</li>
                <li>Facilitator validates the signature, amount, recipient, and deadline</li>
                <li>If valid, middleware calls your route handler (the resource is served)</li>
                <li>Facilitator settles the payment on-chain (async, after response)</li>
              </ol>
            </section>

            {/* Next Steps */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Next Steps</h2>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Add the{" "}
                  <Link href="https://docs.t402.io/sdks/typescript/http-frameworks" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                    Bazaar extension
                  </Link>
                  {" "}for AI agent discoverability</li>
                <li>Enable{" "}
                  <Link href="/writing/gasless-payments" className="text-brand hover:text-brand-secondary">
                    gasless payments
                  </Link>
                  {" "}so users don&apos;t need ETH</li>
                <li>Add non-EVM chains (Solana, TON) for broader wallet support</li>
                <li>Deploy your own facilitator for production independence</li>
              </ul>
            </section>

            {/* CTA */}
            <section className="mt-12 rounded-2xl border border-border bg-background-secondary p-8 text-center">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Full Framework Documentation</h2>
              <p className="mx-auto mb-6 max-w-xl text-foreground-secondary">
                T402 also supports Hono, Fastify, Next.js, and raw Fetch/Axios clients.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/sdks/typescript/http-frameworks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
                  style={{ color: "#0A0A0B" }}
                >
                  HTTP Frameworks
                </Link>
                <Link
                  href="https://docs.t402.io/reference/core"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
                >
                  API Reference
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
