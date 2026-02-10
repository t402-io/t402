import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

const pageTitle = "Beyond EVM: Accepting Payments on TON, Solana, TRON, and More";
const pageDescription =
  "T402 isn't just for Ethereum. Learn how to accept USDT payments on TON (Telegram), Solana, TRON, NEAR, Aptos, Tezos, Polkadot, and Stacks with unified APIs.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/writing/non-evm-chains",
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
  datePublished: "2026-01-26",
  author: { "@type": "Organization", name: "T402 Team", url: "https://t402.io" },
  publisher: { "@type": "Organization", name: "T402", url: "https://t402.io" },
  url: "https://t402.io/writing/non-evm-chains",
  keywords: ["TON", "Solana", "TRON", "NEAR", "Aptos", "Multi-Chain"],
};

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

interface ChainInfo {
  name: string;
  caip2: string;
  tokenStandard: string;
  signature: string;
  users: string;
  features: string[];
  color: string;
}

const chains: ChainInfo[] = [
  {
    name: "TON (Telegram)",
    caip2: "ton:mainnet",
    tokenStandard: "Jetton",
    signature: "Ed25519",
    users: "950M+ Telegram users",
    features: ["Telegram Mini Apps", "Social payments", "Deep wallet integration"],
    color: "#0098EA",
  },
  {
    name: "Solana",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    tokenStandard: "SPL Token",
    signature: "Ed25519",
    users: "High-frequency traders",
    features: ["400ms finality", "65,000 TPS", "Sub-cent fees"],
    color: "#9945FF",
  },
  {
    name: "TRON",
    caip2: "tron:mainnet",
    tokenStandard: "TRC-20",
    signature: "ECDSA secp256k1",
    users: "#1 USDT chain globally",
    features: ["$60B+ USDT volume", "Free bandwidth", "Asia market leader"],
    color: "#FF0000",
  },
  {
    name: "NEAR",
    caip2: "near:mainnet",
    tokenStandard: "NEP-141",
    signature: "Ed25519",
    users: "Developer community",
    features: ["Human-readable accounts", "JavaScript SDK", "Named addresses"],
    color: "#00EC97",
  },
  {
    name: "Aptos",
    caip2: "aptos:1",
    tokenStandard: "Fungible Asset",
    signature: "Ed25519",
    users: "Move ecosystem",
    features: ["Move language", "160k TPS", "Parallel execution"],
    color: "#2DD8A3",
  },
  {
    name: "Tezos",
    caip2: "tezos:NetXdQprcVkpaWU",
    tokenStandard: "FA2",
    signature: "Ed25519 / secp256k1",
    users: "Enterprise & NFT creators",
    features: ["On-chain governance", "Formal verification", "Energy efficient"],
    color: "#2C7DF7",
  },
  {
    name: "Polkadot Asset Hub",
    caip2: "polkadot:68d56f15...",
    tokenStandard: "Asset Hub",
    signature: "Sr25519",
    users: "Cross-chain users",
    features: ["XCM transfers", "Shared security", "Parachain ecosystem"],
    color: "#E6007A",
  },
  {
    name: "Stacks",
    caip2: "stacks:1",
    tokenStandard: "SIP-010",
    signature: "secp256k1",
    users: "Bitcoin maximalists",
    features: ["Bitcoin L2", "BTC finality", "Clarity language"],
    color: "#5546FF",
  },
];

function ChainCard({ chain }: { chain: ChainInfo }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: chain.color }}
        >
          {chain.name.charAt(0)}
        </div>
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "#1A1A2E" }}>{chain.name}</h3>
          <p className="text-xs font-mono" style={{ color: "#A1A1AA" }}>{chain.caip2}</p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span style={{ color: "#A1A1AA" }}>Token Standard</span>
          <span className="font-medium" style={{ color: "#1A1A2E" }}>{chain.tokenStandard}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "#A1A1AA" }}>Signature</span>
          <span className="font-medium" style={{ color: "#1A1A2E" }}>{chain.signature}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "#A1A1AA" }}>Target Users</span>
          <span className="font-medium" style={{ color: "#1A1A2E" }}>{chain.users}</span>
        </div>
      </div>
      <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <p className="text-xs mb-2" style={{ color: "#A1A1AA" }}>Key Features</p>
        <div className="flex flex-wrap gap-1">
          {chain.features.map((feature) => (
            <span
              key={feature}
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: `${chain.color}20`, color: chain.color }}
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NonEvmChainsPage() {
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
                {["Technical", "Multi-Chain"].map((tag) => (
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
                Beyond EVM: Accepting Payments on TON, Solana, TRON, and More
              </h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: "#A1A1AA" }}>
                <span>January 26, 2026</span>
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
                  <strong style={{ color: "#1A1A2E" }}>TL;DR</strong>: T402 supports 9 non-EVM blockchains alongside 19 EVM chains. Each chain has unique characteristics: TON for Telegram users, Solana for speed, TRON for global USDT volume, and more. The T402 SDK provides a unified API across all chains.
                </p>
              </div>

              {/* Why Non-EVM */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Why Non-EVM Chains Matter</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  While EVM chains dominate DeFi, some of the largest stablecoin user bases exist on non-EVM chains. TRON processes more USDT volume than any other chain. TON has direct access to 950M+ Telegram users. Solana offers sub-second finality for high-frequency applications.
                </p>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  By supporting 9 non-EVM chains, T402 enables you to reach users wherever they are, without building separate integrations for each blockchain&apos;s unique architecture.
                </p>
              </section>

              {/* Supported Chains - wider for the cards */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Supported Non-EVM Chains</h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  {chains.map((chain) => (
                    <ChainCard key={chain.name} chain={chain} />
                  ))}
                </div>
              </section>

              {/* Unified API */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Unified API Across Chains</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Despite different signature schemes, token standards, and transaction formats, T402 provides a consistent API. The same code structure works whether you&apos;re accepting TON Jettons or Solana SPL tokens:
                </p>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: "#111113" }}
                >
                  <div className="px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="text-sm font-mono" style={{ color: "#A1A1AA" }}>TypeScript</span>
                  </div>
                  <pre className="p-4 text-sm font-mono overflow-x-auto" style={{ color: "#FAFAFA" }}>
{`import { ExactTonServer } from "@t402/ton/exact/server";
import { ExactSvmServer } from "@t402/svm/exact/server";
import { ExactTronServer } from "@t402/tron/exact/server";

// Same pattern for all chains
app.use(paymentMiddleware({
  "GET /api/data": {
    price: "$0.10",
    schemes: [
      // TON for Telegram users
      new ExactTonServer({
        network: "ton:mainnet",
        payTo: "EQ...",
      }),
      // Solana for speed
      new ExactSvmServer({
        network: "solana:mainnet",
        payTo: "8GGt...",
      }),
      // TRON for global reach
      new ExactTronServer({
        network: "tron:mainnet",
        payTo: "TT1M...",
      }),
    ],
  },
}));`}</pre>
                </div>
              </section>

              {/* Chain Selection */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Choosing the Right Chains</h2>
                {[
                  { title: "For Telegram Integration", body: "TON is the clear choice. With native Telegram wallet integration and Mini Apps support, you can reach 950M+ users directly within the messaging app.", highlight: "TON" },
                  { title: "For Global USDT Users", body: "TRON dominates global USDT transfers with $60B+ volume. Essential for reaching users in Asia, Africa, and emerging markets where TRC-20 USDT is the standard.", highlight: "TRON" },
                  { title: "For High-Frequency Applications", body: "Solana offers 400ms finality and 65,000 TPS. Perfect for trading bots, gaming micropayments, and any application requiring near-instant confirmation.", highlight: "Solana" },
                  { title: "For Developer Experience", body: "NEAR provides human-readable account names (alice.near instead of 0x...) and a JavaScript SDK. Great for onboarding developers new to blockchain.", highlight: "NEAR" },
                  { title: "For Bitcoin Alignment", body: "Stacks is a Bitcoin L2 with Bitcoin finality. Reach Bitcoin maximalists who want smart contract functionality without leaving the BTC ecosystem.", highlight: "Stacks" },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl p-6"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <h3 className="text-lg font-semibold mb-2" style={{ color: "#1A1A2E" }}>{item.title}</h3>
                    <p style={{ color: "#4A5568" }}>
                      <strong style={{ color: "#1A1A2E" }}>{item.highlight}</strong>{" "}
                      {item.body.replace(`${item.highlight} `, "").replace(item.highlight, "")}
                    </p>
                  </div>
                ))}
              </section>

              {/* Get Started */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Get Started</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 SDKs provide consistent interfaces across all 28 supported chains. Start accepting payments on any chain today:
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/chains"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                    style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                  >
                    View All Chains
                    <ArrowRightIcon />
                  </Link>
                  <Link
                    href="https://docs.t402.io/getting-started/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                    style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    Get Started
                  </Link>
                </div>
              </section>
            </div>
          </section>

          {/* Community CTA */}
          <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
                Need Help?
              </h2>
              <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
                Join the T402 community to get help with multi-chain integration, share your projects, and stay updated on new chain support.
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
