"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

// Types
interface PaymentConfig {
  endpoint: string;
  method: string;
  price: string;
  chain: string;
  token: string;
  resource: string;
}

interface Step {
  id: number;
  title: string;
  description: string;
  status: "pending" | "active" | "completed";
}

// Icons
function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ServerIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function WalletIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

// Chain options
const chains = [
  { id: "base", name: "Base", network: "eip155:8453", color: "#0052FF", type: "evm" as const },
  { id: "ethereum", name: "Ethereum", network: "eip155:1", color: "#627EEA", type: "evm" as const },
  { id: "arbitrum", name: "Arbitrum", network: "eip155:42161", color: "#28A0F0", type: "evm" as const },
  { id: "optimism", name: "Optimism", network: "eip155:10", color: "#FF0420", type: "evm" as const },
  { id: "ink", name: "Ink", network: "eip155:57073", color: "#7B3FE4", type: "evm" as const },
  { id: "berachain", name: "Berachain", network: "eip155:80094", color: "#FF6B35", type: "evm" as const },
  { id: "unichain", name: "Unichain", network: "eip155:130", color: "#FF007A", type: "evm" as const },
  { id: "polygon", name: "Polygon", network: "eip155:137", color: "#8247E5", type: "evm" as const },
  { id: "mantle", name: "Mantle", network: "eip155:5000", color: "#000000", type: "evm" as const },
  { id: "sei", name: "Sei", network: "eip155:1329", color: "#9B1C2E", type: "evm" as const },
  { id: "avalanche", name: "Avalanche", network: "eip155:43114", color: "#E84142", type: "evm" as const },
  { id: "bnb", name: "BNB Chain", network: "eip155:56", color: "#F0B90B", type: "evm" as const },
  { id: "zksync", name: "zkSync Era", network: "eip155:324", color: "#4E529A", type: "evm" as const },
  { id: "linea", name: "Linea", network: "eip155:59144", color: "#61DFFF", type: "evm" as const },
  { id: "scroll", name: "Scroll", network: "eip155:534352", color: "#FFEEDA", type: "evm" as const },
  { id: "corn", name: "Corn", network: "eip155:21000000", color: "#F5C842", type: "evm" as const },
  { id: "conflux", name: "Conflux eSpace", network: "eip155:1030", color: "#1A1A2E", type: "evm" as const },
  { id: "solana", name: "Solana", network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", color: "#9945FF", type: "solana" as const },
  { id: "ton", name: "TON", network: "ton:mainnet", color: "#0098EA", type: "ton" as const },
  { id: "tron", name: "TRON", network: "tron:mainnet", color: "#FF0013", type: "tron" as const },
  { id: "near", name: "NEAR", network: "near:mainnet", color: "#000000", type: "near" as const },
  { id: "aptos", name: "Aptos", network: "aptos:1", color: "#000000", type: "aptos" as const },
  { id: "tezos", name: "Tezos", network: "tezos:NetXdQprcVkpaWU", color: "#2C7DF7", type: "tezos" as const },
  { id: "polkadot", name: "Polkadot", network: "polkadot:68d56f15f85d3136970ec16946040bc1", color: "#E6007A", type: "polkadot" as const },
  { id: "stacks", name: "Stacks", network: "stacks:1", color: "#5546FF", type: "stacks" as const },
];

const tokens = [
  { id: "USDT", name: "Tether USD" },
  { id: "USDT0", name: "USDT0 (Omnichain)" },
];

function generatePaymentHeader(config: PaymentConfig): string {
  const chain = chains.find((c) => c.id === config.chain);
  const getPayToAddress = () => {
    switch (chain?.type) {
      case "ton": return "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a";
      case "tron": return "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5";
      case "solana": return "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL";
      case "near": return "facilitator.t402.near";
      case "aptos": return "0xc88f67e776f16dcfbf42e6bdda1b82604448899b000000000000000000000000";
      case "tezos": return "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
      case "polkadot": return "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
      case "stacks": return "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9";
      default: return "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";
    }
  };
  const payload = {
    version: "1",
    accepts: [{
      scheme: "exact",
      network: chain?.network || "eip155:8453",
      maxAmountRequired: (parseFloat(config.price.replace("$", "")) * 1000000).toString(),
      resource: config.resource,
      payTo: getPayToAddress(),
      token: config.token,
    }],
  };
  return JSON.stringify(payload, null, 2);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-70"
      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <CheckIcon style={{ color: "#50AF95" } as React.CSSProperties} /> : <CopyIcon />}
    </button>
  );
}

function StepIndicator({ step, isActive, isCompleted }: { step: Step; isActive: boolean; isCompleted: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors"
        style={
          isCompleted
            ? { backgroundColor: "#50AF95", color: "#0A0A0B" }
            : isActive
            ? { backgroundColor: "rgba(80,175,149,0.2)", color: "#50AF95" }
            : { backgroundColor: "rgba(255,255,255,0.06)", color: "#A1A1AA" }
        }
      >
        {isCompleted ? <CheckIcon className="h-4 w-4" /> : step.id}
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: isActive || isCompleted ? "#FAFAFA" : "#A1A1AA" }}>
          {step.title}
        </p>
        <p className="text-xs" style={{ color: "#A1A1AA" }}>{step.description}</p>
      </div>
    </div>
  );
}

function CodeBlock({ code, title }: { code: string; language: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="text-xs font-medium" style={{ color: "#A1A1AA" }}>{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4" style={{ backgroundColor: "#111113" }}>
        <code className="text-xs leading-relaxed" style={{ color: "#A1A1AA" }}>{code}</code>
      </pre>
    </div>
  );
}

export default function PlaygroundClient() {
  const [config, setConfig] = useState<PaymentConfig>({
    endpoint: "/api/premium-content",
    method: "GET",
    price: "$0.10",
    chain: "base",
    token: "USDC",
    resource: "Premium API access",
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  const steps: Step[] = [
    { id: 1, title: "Client Request", description: "Make HTTP request without payment", status: "pending" },
    { id: 2, title: "402 Response", description: "Server returns payment required", status: "pending" },
    { id: 3, title: "User Pays", description: "Wallet signs payment authorization", status: "pending" },
    { id: 4, title: "Verified Access", description: "Content delivered after payment", status: "pending" },
  ];

  const runDemo = async () => {
    setIsRunning(true);
    setShowResponse(false);
    setCurrentStep(0);
    await new Promise((r) => setTimeout(r, 800));
    setCurrentStep(1);
    await new Promise((r) => setTimeout(r, 1000));
    setCurrentStep(2);
    setShowResponse(true);
    await new Promise((r) => setTimeout(r, 1200));
    setCurrentStep(3);
    await new Promise((r) => setTimeout(r, 1000));
    setCurrentStep(4);
    setIsRunning(false);
  };

  const resetDemo = () => {
    setCurrentStep(0);
    setShowResponse(false);
    setIsRunning(false);
  };

  const paymentHeader = generatePaymentHeader(config);

  const requestCode = `fetch("https://api.example.com${config.endpoint}", {
  method: "${config.method}",
  headers: {
    "Content-Type": "application/json",
  },
})`;

  const responseCode = `HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment: ${paymentHeader.split('\n').join('\n         ')}

{
  "error": "Payment required",
  "message": "This endpoint requires payment",
  "price": "${config.price}",
  "accepts": ["${config.token} on ${chains.find(c => c.id === config.chain)?.name}"]
}`;

  const paymentCode = `import { createPayment } from "@t402/evm";

const payment = await createPayment({
  paymentHeader: response.headers.get("X-Payment"),
  wallet: connectedWallet,
});

// Retry request with payment proof
fetch("https://api.example.com${config.endpoint}", {
  headers: {
    "X-Payment-Response": payment.signature,
  },
})`;

  const successCode = `HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": "Your premium content here...",
  "payment": {
    "verified": true,
    "amount": "${config.price}",
    "txHash": "0x1234...abcd"
  }
}`;

  const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#FAFAFA",
  };

  return (
    <>
      {/* Dark Header */}
      <section style={{ backgroundColor: "#0A0A0B" }} className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="uppercase text-xs tracking-widest font-semibold mb-4" style={{ color: "#50AF95" }}>
              Demo
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ color: "#FAFAFA" }}>
              Interactive Playground
            </h1>
            <p className="mx-auto max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              See how t402 payments work in real-time. Configure your payment settings and watch
              the HTTP 402 flow in action.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Interactive Area on Dark BG */}
      <section style={{ backgroundColor: "#111113" }} className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            {/* Configuration Panel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-1"
            >
              <div className="space-y-6 lg:sticky lg:top-24">
                <div className="rounded-2xl p-6" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h2 className="mb-4 text-lg font-semibold" style={{ color: "#FAFAFA" }}>Configuration</h2>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: "#A1A1AA" }}>Endpoint</label>
                    <input type="text" value={config.endpoint} onChange={(e) => setConfig({ ...config, endpoint: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1" style={{ ...inputStyle, "--tw-ring-color": "#50AF95" } as React.CSSProperties} />
                  </div>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: "#A1A1AA" }}>Method</label>
                    <select value={config.method} onChange={(e) => setConfig({ ...config, method: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1" style={inputStyle}>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: "#A1A1AA" }}>Price</label>
                    <input type="text" value={config.price} onChange={(e) => setConfig({ ...config, price: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1" style={inputStyle} />
                  </div>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: "#A1A1AA" }}>Chain</label>
                    <select value={config.chain} onChange={(e) => setConfig({ ...config, chain: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1" style={inputStyle}>
                      {chains.map((chain) => (
                        <option key={chain.id} value={chain.id}>{chain.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: "#A1A1AA" }}>Token</label>
                    <select value={config.token} onChange={(e) => setConfig({ ...config, token: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1" style={inputStyle}>
                      {tokens.map((token) => (
                        <option key={token.id} value={token.id}>{token.id} - {token.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: "#A1A1AA" }}>Resource Description</label>
                    <input type="text" value={config.resource} onChange={(e) => setConfig({ ...config, resource: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1" style={inputStyle} />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={runDemo} disabled={isRunning} className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}>
                      <PlayIcon className="h-4 w-4" />
                      {isRunning ? "Running..." : "Run Demo"}
                    </button>
                    <button onClick={resetDemo} className="flex items-center justify-center rounded-xl px-3 py-2.5 transition-colors hover:opacity-70" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#A1A1AA" }}>
                      <RefreshIcon />
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl p-6" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h3 className="mb-4 text-sm font-semibold" style={{ color: "#FAFAFA" }}>Payment Flow</h3>
                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <StepIndicator key={step.id} step={step} isActive={currentStep === index + 1} isCompleted={currentStep > index + 1} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Demo Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-2"
            >
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="rounded-2xl p-6 transition-all" style={{ border: currentStep >= 1 ? "1px solid rgba(80,175,149,0.4)" : "1px solid rgba(255,255,255,0.08)", backgroundColor: currentStep >= 1 ? "rgba(80,175,149,0.05)" : "rgba(255,255,255,0.03)" }}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(59,130,246,0.2)" }}>
                      <ServerIcon style={{ color: "#3B82F6" }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: "#FAFAFA" }}>1. Client Request</h3>
                      <p className="text-sm" style={{ color: "#A1A1AA" }}>Client makes HTTP request to protected endpoint</p>
                    </div>
                  </div>
                  <CodeBlock code={requestCode} language="javascript" title="request.js" />
                </div>

                {/* Step 2 */}
                <AnimatePresence>
                  {(currentStep >= 2 || showResponse) && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="rounded-2xl p-6 transition-all" style={{ border: "1px solid rgba(234,179,8,0.4)", backgroundColor: "rgba(234,179,8,0.05)" }}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(234,179,8,0.2)" }}>
                          <span className="text-lg font-bold" style={{ color: "#EAB308" }}>402</span>
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: "#FAFAFA" }}>2. Payment Required</h3>
                          <p className="text-sm" style={{ color: "#A1A1AA" }}>Server returns 402 with payment instructions</p>
                        </div>
                      </div>
                      <CodeBlock code={responseCode} language="http" title="response" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step 3 */}
                <AnimatePresence>
                  {currentStep >= 3 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="rounded-2xl p-6" style={{ border: "1px solid rgba(147,51,234,0.4)", backgroundColor: "rgba(147,51,234,0.05)" }}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(147,51,234,0.2)" }}>
                          <WalletIcon style={{ color: "#9333EA" }} />
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: "#FAFAFA" }}>3. User Signs Payment</h3>
                          <p className="text-sm" style={{ color: "#A1A1AA" }}>Wallet signs payment authorization (gasless)</p>
                        </div>
                      </div>
                      <CodeBlock code={paymentCode} language="javascript" title="payment.js" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step 4 */}
                <AnimatePresence>
                  {currentStep >= 4 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="rounded-2xl p-6" style={{ border: "1px solid rgba(80,175,149,0.4)", backgroundColor: "rgba(80,175,149,0.05)" }}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(80,175,149,0.2)" }}>
                          <CheckCircleIcon style={{ color: "#50AF95" }} />
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: "#FAFAFA" }}>4. Access Granted</h3>
                          <p className="text-sm" style={{ color: "#A1A1AA" }}>Payment verified, content delivered</p>
                        </div>
                      </div>
                      <CodeBlock code={successCode} language="http" title="success response" />
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-xl p-4" style={{ backgroundColor: "rgba(80,175,149,0.1)" }}>
                        <p className="text-center text-sm font-medium" style={{ color: "#50AF95" }}>
                          Payment complete! User received access to {config.resource}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA on Light BG */}
      <section style={{ backgroundColor: "#F7FAF9" }} className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="rounded-2xl p-8 sm:p-12 text-center"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
              Ready to integrate?
            </h2>
            <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
              Add t402 payments to your API in minutes. Our SDKs handle all the complexity -
              you just define your pricing.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
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
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                Quickstart Guide
                <ExternalLinkIcon />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 grid gap-6 sm:grid-cols-3"
          >
            {[
              { title: "HTTP Native", desc: "Uses standard HTTP 402 status code. Works with any HTTP client, any programming language." },
              { title: "Gasless Payments", desc: "Users sign a message, not a transaction. No gas fees required for EIP-3009 compatible tokens." },
              { title: "Instant Settlement", desc: "Payments are verified and settled in real-time. No waiting for confirmations on supported chains." },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl p-8" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                <h3 className="mb-2 font-semibold" style={{ color: "#1A1A2E" }}>{card.title}</h3>
                <p className="text-sm" style={{ color: "#4A5568" }}>{card.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
