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
                {["Tutorial", "Express.js", "TypeScript"].map((tag) => (
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
                Add Payments to Your Express.js API in 5 Minutes
              </h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: "#A1A1AA" }}>
                <span>January 23, 2026</span>
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
                  <strong style={{ color: "#1A1A2E" }}>TL;DR</strong>: Install <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/express</code> and <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/evm</code>, add the middleware to your route, configure your payment address — done. Your API now returns 402 for unauthorized requests and accepts USDT payments via the X-Payment header.
                </p>
              </div>

              {/* Prerequisites */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Prerequisites</h2>
                <ul className="list-disc pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li>Node.js 18+ and npm/pnpm</li>
                  <li>An existing Express.js application (or create one fresh)</li>
                  <li>A wallet address to receive payments (any EVM address)</li>
                </ul>
              </section>

              {/* Step 1 */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Step 1: Install Packages</h2>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p>npm install @t402/express @t402/evm @t402/core</p>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Three packages: <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/express</code> provides the middleware, <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/evm</code> handles EVM chain verification, and <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/core</code> provides shared types.
                </p>
              </section>

              {/* Step 2 */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Step 2: Configure the Middleware</h2>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// payment.ts</p>
                  <p>import {"{"} createPaymentMiddleware {"}"} from &apos;@t402/express&apos;;</p>
                  <p>import {"{"} ExactEvmScheme {"}"} from &apos;@t402/evm&apos;;</p>
                  <p className="mt-2">const scheme = ExactEvmScheme.server({"{"}</p>
                  <p>{"  "}rpcUrl: process.env.RPC_URL || &apos;https://mainnet.base.org&apos;</p>
                  <p>{"}"});</p>
                  <p className="mt-2">export const paymentMiddleware = createPaymentMiddleware({"{"}</p>
                  <p>{"  "}scheme,</p>
                  <p>{"  "}facilitatorUrl: &apos;https://facilitator.t402.io&apos;,</p>
                  <p>{"  "}defaultRequirements: {"{"}</p>
                  <p>{"    "}scheme: &apos;exact&apos;,</p>
                  <p>{"    "}network: &apos;eip155:8453&apos;,</p>
                  <p>{"    "}payTo: process.env.PAY_TO_ADDRESS!,</p>
                  <p>{"  "}{"}"}</p>
                  <p>{"}"});</p>
                </div>
              </section>

              {/* Step 3 */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Step 3: Protect Your Routes</h2>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// app.ts</p>
                  <p>import express from &apos;express&apos;;</p>
                  <p>import {"{"} paymentMiddleware {"}"} from &apos;./payment&apos;;</p>
                  <p className="mt-2">const app = express();</p>
                  <p className="mt-2" style={{ color: "#A1A1AA" }}>// Free endpoint — no payment required</p>
                  <p>app.get(&apos;/health&apos;, (req, res) =&gt; {"{"}</p>
                  <p>{"  "}res.json({"{"} status: &apos;ok&apos; {"}"});</p>
                  <p>{"}"});</p>
                  <p className="mt-2" style={{ color: "#A1A1AA" }}>// Paid endpoint — requires $0.01 USDT</p>
                  <p>app.get(&apos;/api/premium&apos;,</p>
                  <p>{"  "}paymentMiddleware({"{"} amount: &apos;10000&apos; {"}"}), // 0.01 USDT (6 decimals)</p>
                  <p>{"  "}(req, res) =&gt; {"{"}</p>
                  <p>{"    "}res.json({"{"} data: &apos;Premium content here&apos; {"}"});</p>
                  <p>{"  "}{"}"}</p>
                  <p>);</p>
                  <p className="mt-2">app.listen(3000);</p>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  That&apos;s it. When a client hits <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>/api/premium</code> without payment, they get a 402 response with payment requirements. When they include a valid X-Payment header, the middleware verifies the payment and calls your handler.
                </p>
              </section>

              {/* Step 4 */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Step 4: Test It</h2>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}># Start your server</p>
                  <p>npm run dev</p>
                  <p className="mt-2" style={{ color: "#A1A1AA" }}># Request without payment → 402</p>
                  <p>curl -s http://localhost:3000/api/premium | jq .</p>
                  <p style={{ color: "#A1A1AA" }}># {"{"}</p>
                  <p style={{ color: "#A1A1AA" }}>#   &quot;error&quot;: &quot;Payment required&quot;,</p>
                  <p style={{ color: "#A1A1AA" }}>#   &quot;accepts&quot;: [{"{"}&quot;scheme&quot;:&quot;exact&quot;,&quot;network&quot;:&quot;eip155:8453&quot;,...{"}"}]</p>
                  <p style={{ color: "#A1A1AA" }}># {"}"}</p>
                  <p className="mt-2" style={{ color: "#A1A1AA" }}># Pay using the T402 CLI</p>
                  <p>t402 request http://localhost:3000/api/premium</p>
                  <p style={{ color: "#A1A1AA" }}># {"{"}&quot;data&quot;:&quot;Premium content here&quot;{"}"}</p>
                </div>
              </section>

              {/* Per-Route Pricing */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Per-Route Pricing</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Different endpoints can have different prices:
                </p>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// $0.001 per weather query</p>
                  <p>app.get(&apos;/api/weather&apos;, paymentMiddleware({"{"} amount: &apos;1000&apos; {"}"}), handler);</p>
                  <p className="mt-2" style={{ color: "#A1A1AA" }}>// $0.05 per AI generation</p>
                  <p>app.post(&apos;/api/generate&apos;, paymentMiddleware({"{"} amount: &apos;50000&apos; {"}"}), handler);</p>
                  <p className="mt-2" style={{ color: "#A1A1AA" }}>// $1.00 per premium dataset</p>
                  <p>app.get(&apos;/api/dataset&apos;, paymentMiddleware({"{"} amount: &apos;1000000&apos; {"}"}), handler);</p>
                </div>
              </section>

              {/* Multi-Chain */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Accept Multiple Chains</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Offer clients a choice of payment networks:
                </p>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p>app.get(&apos;/api/data&apos;,</p>
                  <p>{"  "}paymentMiddleware({"{"}</p>
                  <p>{"    "}amount: &apos;10000&apos;,</p>
                  <p>{"    "}accepts: [</p>
                  <p>{"      "}{"{"} network: &apos;eip155:8453&apos; {"}"},{"  "}<span style={{ color: "#A1A1AA" }}>// Base</span></p>
                  <p>{"      "}{"{"} network: &apos;eip155:42161&apos; {"}"}, <span style={{ color: "#A1A1AA" }}>// Arbitrum</span></p>
                  <p>{"      "}{"{"} network: &apos;eip155:10&apos; {"}"},{"    "}<span style={{ color: "#A1A1AA" }}>// Optimism</span></p>
                  <p>{"    "}]</p>
                  <p>{"  "}{"}"});</p>
                  <p>{"  "}handler</p>
                  <p>);</p>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  The 402 response will include all accepted networks, and the client picks whichever chain they have funds on.
                </p>
              </section>

              {/* Environment Variables */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Environment Variables</h2>
                <div
                  className="rounded-xl p-4 font-mono text-sm"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}># .env</p>
                  <p>PAY_TO_ADDRESS=0xYourWalletAddress</p>
                  <p>RPC_URL=https://mainnet.base.org</p>
                  <p>FACILITATOR_URL=https://facilitator.t402.io</p>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>PAY_TO_ADDRESS</code> is where payments are settled. This is your standard EVM wallet address. Funds arrive in USDT on the specified chain.
                </p>
              </section>

              {/* Under the Hood */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>What Happens Under the Hood</h2>
                <ol className="list-decimal pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li>Client sends GET without payment - middleware returns 402 with payment requirements in X-Payment header and response body</li>
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
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Next Steps</h2>
                <ul className="list-disc pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li>Add the{" "}
                    <Link href="https://docs.t402.io/sdks/typescript/http-frameworks" target="_blank" rel="noopener noreferrer" style={{ color: "#50AF95" }} className="hover:opacity-80">
                      Bazaar extension
                    </Link>
                    {" "}for AI agent discoverability</li>
                  <li>Enable{" "}
                    <Link href="/writing/gasless-payments" style={{ color: "#50AF95" }} className="hover:opacity-80">
                      gasless payments
                    </Link>
                    {" "}so users don&apos;t need ETH</li>
                  <li>Add non-EVM chains (Solana, TON) for broader wallet support</li>
                  <li>Deploy your own facilitator for production independence</li>
                </ul>
              </section>
            </div>
          </section>

          {/* CTA */}
          <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
                Full Framework Documentation
              </h2>
              <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
                T402 also supports Hono, Fastify, Next.js, and raw Fetch/Axios clients.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/sdks/typescript/http-frameworks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                >
                  HTTP Frameworks
                </Link>
                <Link
                  href="https://docs.t402.io/reference/core"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  API Reference
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
