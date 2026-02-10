import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import { chains, getChainById } from "../data";

interface Props {
  params: Promise<{ chainId: string }>;
}

export function generateStaticParams() {
  return chains.map((chain) => ({ chainId: chain.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chainId } = await params;
  const chain = getChainById(chainId);
  if (!chain) return {};

  const title = `${chain.name} — T402 Payment Integration`;
  const description = `Accept USDT payments on ${chain.name} with T402. ${chain.description} ${chain.features.join(", ")}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/chains/${chain.id}`,
    },
  };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    live: { bg: "rgba(80, 175, 149, 0.1)", color: "#50AF95" },
    coming_soon: { bg: "rgba(245, 158, 11, 0.1)", color: "#F59E0B" },
    testnet: { bg: "rgba(59, 130, 246, 0.1)", color: "#3B82F6" },
  };
  const labels: Record<string, string> = {
    live: "Live",
    coming_soon: "Coming Soon",
    testnet: "Testnet",
  };
  const s = styles[status] || { bg: "transparent", color: "#A1A1AA" };
  return (
    <span className="rounded-md px-3 py-1 text-sm font-medium" style={{ background: s.bg, color: s.color }}>
      {labels[status] || status}
    </span>
  );
}

function TokenTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    eip3009: "EIP-3009 (Gasless)",
    legacy: "Legacy Transfer",
    spl: "SPL Token",
    jetton: "Jetton (TON)",
    trc20: "TRC-20",
    nep141: "NEP-141",
    "fungible-asset": "Fungible Asset",
    fa2: "FA2 (TZIP-12)",
    "asset-hub": "Asset Hub",
    sip010: "SIP-010",
    ibc: "IBC Transfer",
  };
  return <span>{labels[type] || type}</span>;
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 inline-block" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function getCodeExample(chain: { id: string; name: string; category: string; caip2?: string; tokens: { symbol: string; address?: string }[] }) {
  const token = chain.tokens[0];
  if (chain.category === "evm") {
    return {
      title: "TypeScript — Express.js Middleware",
      code: `import { createPaymentMiddleware } from '@t402/express';
import { ExactEvmScheme } from '@t402/evm';

const scheme = ExactEvmScheme.server({
  rpcUrl: process.env.RPC_URL
});

app.get('/api/data',
  createPaymentMiddleware({
    scheme,
    facilitatorUrl: 'https://facilitator.t402.io',
    defaultRequirements: {
      scheme: 'exact',
      network: '${chain.caip2}',
      payTo: process.env.PAY_TO_ADDRESS!
    }
  })({ amount: '10000' }), // $0.01 ${token.symbol}
  handler
);`,
    };
  }
  if (chain.category === "svm") {
    return {
      title: "TypeScript — Solana Integration",
      code: `import { ExactSvmClient } from '@t402/svm/exact/client';

const client = new ExactSvmClient({
  connection,
  wallet: walletAdapter
});

// Sign payment for ${chain.name}
const payload = await client.createPaymentPayload({
  scheme: 'exact',
  network: '${chain.caip2}',
  amount: '10000', // $0.01 ${token.symbol}
  payTo: recipientAddress,
  asset: '${token.address || "token-address"}'
});`,
    };
  }
  if (chain.category === "ton") {
    return {
      title: "TypeScript — TON Integration",
      code: `import { ExactTonClient } from '@t402/ton/exact/client';

const client = new ExactTonClient({
  tonConnect: connector
});

// Sign Jetton transfer for ${chain.name}
const payload = await client.createPaymentPayload({
  scheme: 'exact',
  network: '${chain.caip2}',
  amount: '10000', // $0.01 ${token.symbol}
  payTo: recipientAddress,
  asset: '${token.address || "jetton-master"}'
});`,
    };
  }
  if (chain.category === "tron") {
    return {
      title: "TypeScript — TRON Integration",
      code: `import { ExactTronClient } from '@t402/tron/exact/client';

const client = new ExactTronClient({
  tronWeb: window.tronWeb
});

// Sign TRC-20 transfer for ${chain.name}
const payload = await client.createPaymentPayload({
  scheme: 'exact',
  network: '${chain.caip2}',
  amount: '10000', // $0.01 ${token.symbol}
  payTo: recipientAddress,
  asset: '${token.address || "contract-address"}'
});`,
    };
  }
  // Generic for other chains
  return {
    title: `TypeScript — ${chain.name} Integration`,
    code: `// Install: npm install @t402/${chain.category}

import { Exact${chain.category.charAt(0).toUpperCase() + chain.category.slice(1)}Client } from '@t402/${chain.category}/exact/client';

const payload = await client.createPaymentPayload({
  scheme: 'exact',
  network: '${chain.caip2}',
  amount: '10000', // $0.01 ${token.symbol}
  payTo: recipientAddress
});`,
  };
}

export default async function ChainDetailPage({ params }: Props) {
  const { chainId } = await params;
  const chain = getChainById(chainId);

  if (!chain) {
    notFound();
  }

  const codeExample = getCodeExample(chain);
  const categoryLabels: Record<string, string> = {
    evm: "EVM",
    svm: "Solana",
    ton: "TON",
    tron: "TRON",
    near: "NEAR",
    aptos: "Aptos",
    tezos: "Tezos",
    polkadot: "Polkadot",
    stacks: "Stacks",
    cosmos: "Cosmos",
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0A0A0B", color: "#FAFAFA" }}>
      <NavBar />

      <div className="flex-1">
        <article>
          {/* Hero Header - Dark with chain color accent */}
          <header className="section-dark py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
              <div className="mb-6 flex items-center gap-3">
                <Link href="/chains" className="text-sm transition-colors" style={{ color: "#71717A" }}>
                  All Chains
                </Link>
                <span style={{ color: "#71717A" }}>/</span>
                <span className="text-sm" style={{ color: "#A1A1AA" }}>{categoryLabels[chain.category]}</span>
              </div>

              <div className="flex items-start gap-5">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
                  style={{ backgroundColor: `${chain.color}20`, color: chain.color }}
                >
                  {chain.shortName.slice(0, 3)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>{chain.name}</h1>
                    <StatusBadge status={chain.status} />
                  </div>
                  <p className="mt-3 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>{chain.description}</p>
                </div>
              </div>

              {/* Key Stats */}
              <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Network ID", value: chain.caip2 || "—", mono: true },
                  { label: "Speed", value: chain.transactionSpeed },
                  { label: "Avg Fee", value: chain.avgFee },
                  { label: "Family", value: categoryLabels[chain.category] },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl p-4 text-center"
                    style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <p className="text-sm" style={{ color: "#71717A" }}>{stat.label}</p>
                    <p
                      className={`mt-1 text-lg font-semibold ${stat.mono ? "font-mono text-sm break-all" : ""}`}
                      style={{ color: "#FAFAFA" }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {/* Features & Tokens - Light Section */}
          <section className="section-light py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
              <div className="grid gap-12 lg:grid-cols-2">
                {/* Features */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                    Capabilities
                  </span>
                  <h2 className="mt-4 mb-6 text-2xl font-bold tracking-tight" style={{ color: "#1A1A2E" }}>Features</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {chain.features.map((feature) => (
                      <div
                        key={feature}
                        className="card-elevated flex items-center gap-3 px-5 py-4"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0" style={{ color: "#50AF95" }} aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Supported Tokens */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                    Assets
                  </span>
                  <h2 className="mt-4 mb-6 text-2xl font-bold tracking-tight" style={{ color: "#1A1A2E" }}>Supported Tokens</h2>
                  <div className="space-y-3">
                    {chain.tokens.map((token) => (
                      <div key={token.symbol} className="card-elevated p-6">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="text-lg font-semibold" style={{ color: "#1A1A2E" }}>{token.symbol}</p>
                            <p className="text-sm" style={{ color: "#718096" }}>{token.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {token.gasless && (
                              <span
                                className="rounded-md px-2 py-1 text-xs font-medium"
                                style={{ background: "rgba(80, 175, 149, 0.1)", color: "#50AF95" }}
                              >
                                Gasless
                              </span>
                            )}
                            <span
                              className="rounded-md px-2 py-1 text-xs font-medium"
                              style={{ background: "#F7FAF9", color: "#4A5568" }}
                            >
                              <TokenTypeLabel type={token.type} />
                            </span>
                          </div>
                        </div>
                        {token.address && (
                          <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "#F7FAF9" }}>
                            <p className="mb-1 text-xs" style={{ color: "#718096" }}>Contract Address</p>
                            <p className="break-all font-mono text-xs" style={{ color: "#4A5568" }}>{token.address}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Code Example - Dark Section */}
          <section className="section-dark-alt py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
              <div className="mx-auto max-w-3xl">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                  Integration
                </span>
                <h2 className="mt-4 mb-8 text-2xl font-bold tracking-tight" style={{ color: "#FAFAFA" }}>Code Example</h2>
                <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="px-4 py-3" style={{ background: "#111113", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-sm font-medium" style={{ color: "#A1A1AA" }}>{codeExample.title}</p>
                  </div>
                  <pre className="overflow-x-auto p-4 text-sm leading-relaxed" style={{ background: "#0A0A0B" }}>
                    <code style={{ color: "#A1A1AA" }}>{codeExample.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Resources & CTA - Light Alt Section */}
          <section className="section-light-alt py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
              <div className="mx-auto max-w-3xl">
                {/* Resources */}
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                  Resources
                </span>
                <h2 className="mt-4 mb-6 text-2xl font-bold tracking-tight" style={{ color: "#1A1A2E" }}>Explore Further</h2>
                <div className="mb-16 grid gap-3 sm:grid-cols-2">
                  <Link
                    href={chain.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-elevated flex items-center justify-between px-5 py-4 text-sm font-medium"
                    style={{ color: "#1A1A2E" }}
                  >
                    Block Explorer
                    <ExternalLinkIcon />
                  </Link>
                  <Link
                    href="https://docs.t402.io/chains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-elevated flex items-center justify-between px-5 py-4 text-sm font-medium"
                    style={{ color: "#1A1A2E" }}
                  >
                    T402 Documentation
                    <ExternalLinkIcon />
                  </Link>
                </div>

                {/* CTA */}
                <div className="text-center">
                  <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#1A1A2E" }}>
                    Start Building on {chain.name}
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "#4A5568" }}>
                    Accept {chain.tokens[0]?.symbol || "stablecoin"} payments on {chain.name} with the T402 SDK. Zero protocol fees, instant settlement.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link
                      href="https://docs.t402.io/getting-started/quickstart"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold transition-all"
                      style={{ background: "#50AF95", color: "#0A0A0B" }}
                    >
                      Get Started
                    </Link>
                    <Link
                      href="/chains"
                      className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold transition-all"
                      style={{ border: "1px solid rgba(0,0,0,0.1)", color: "#1A1A2E" }}
                    >
                      All Chains
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
