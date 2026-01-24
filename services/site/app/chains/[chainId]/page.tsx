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
  const styles = {
    live: "bg-success/10 text-success",
    coming_soon: "bg-warning/10 text-warning",
    testnet: "bg-info/10 text-info",
  };
  const labels = {
    live: "Live",
    coming_soon: "Coming Soon",
    testnet: "Testnet",
  };
  return (
    <span className={`rounded-md px-3 py-1 text-sm font-medium ${styles[status as keyof typeof styles] || ""}`}>
      {labels[status as keyof typeof labels] || status}
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block ml-1" aria-hidden="true">
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <div className="flex-1">
        <article className="pb-20">
          {/* Header */}
          <header className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-16 md:pt-20">
            <div className="mb-4 flex items-center gap-3">
              <Link href="/chains" className="text-sm text-foreground-tertiary hover:text-foreground-secondary transition-colors">
                All Chains
              </Link>
              <span className="text-foreground-tertiary">/</span>
              <span className="text-sm text-foreground-secondary">{categoryLabels[chain.category]}</span>
            </div>

            <div className="flex items-start gap-4 mb-6">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold"
                style={{ backgroundColor: `${chain.color}20`, color: chain.color }}
              >
                {chain.shortName.slice(0, 3)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl font-bold">{chain.name}</h1>
                  <StatusBadge status={chain.status} />
                </div>
                <p className="mt-2 text-lg text-foreground-secondary">{chain.description}</p>
              </div>
            </div>
          </header>

          <section className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 space-y-8">
            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
                <p className="text-sm text-foreground-tertiary">Network ID</p>
                <p className="mt-1 font-mono text-sm font-medium text-foreground break-all">{chain.caip2}</p>
              </div>
              <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
                <p className="text-sm text-foreground-tertiary">Speed</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{chain.transactionSpeed}</p>
              </div>
              <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
                <p className="text-sm text-foreground-tertiary">Avg Fee</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{chain.avgFee}</p>
              </div>
              <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
                <p className="text-sm text-foreground-tertiary">Family</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{categoryLabels[chain.category]}</p>
              </div>
            </div>

            {/* Features */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Features</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {chain.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 rounded-lg border border-border bg-background-secondary px-4 py-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand flex-shrink-0" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-sm font-medium text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Supported Tokens */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Supported Tokens</h2>
              <div className="space-y-3">
                {chain.tokens.map((token) => (
                  <div key={token.symbol} className="rounded-xl border border-border bg-background-secondary p-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{token.symbol}</p>
                        <p className="text-sm text-foreground-tertiary">{token.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {token.gasless && (
                          <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand">
                            Gasless
                          </span>
                        )}
                        <span className="rounded-md bg-background-tertiary px-2 py-1 text-xs font-medium text-foreground-secondary">
                          <TokenTypeLabel type={token.type} />
                        </span>
                      </div>
                    </div>
                    {token.address && (
                      <div className="mt-3 rounded-lg bg-background-tertiary px-3 py-2">
                        <p className="text-xs text-foreground-tertiary mb-1">Contract Address</p>
                        <p className="font-mono text-xs text-foreground-secondary break-all">{token.address}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Code Example */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Integration Example</h2>
              <div className="rounded-xl border border-border bg-background-tertiary overflow-hidden">
                <div className="border-b border-border px-4 py-2">
                  <p className="text-sm font-medium text-foreground-secondary">{codeExample.title}</p>
                </div>
                <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
                  <code className="text-foreground-secondary">{codeExample.code}</code>
                </pre>
              </div>
            </section>

            {/* Links */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Resources</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href={chain.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-border bg-background-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-border-secondary"
                >
                  Block Explorer
                  <ExternalLinkIcon />
                </Link>
                <Link
                  href={chain.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-border bg-background-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-border-secondary"
                >
                  T402 Documentation
                  <ExternalLinkIcon />
                </Link>
              </div>
            </section>

            {/* CTA */}
            <section className="mt-12 rounded-2xl border border-border bg-background-secondary p-8 text-center">
              <h2 className="mb-4 text-2xl font-bold text-foreground">
                Start Building on {chain.name}
              </h2>
              <p className="mx-auto mb-6 max-w-xl text-foreground-secondary">
                Accept {chain.tokens[0]?.symbol || "stablecoin"} payments on {chain.name} with the T402 SDK. Zero protocol fees, instant settlement.
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
                  All Chains
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
