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
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function RefreshIcon({ className = "" }: { className?: string }) {
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
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

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
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ServerIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function WalletIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

// Chain options
const chains = [
  { id: "base", name: "Base", chainId: 8453, color: "#0052FF" },
  { id: "ethereum", name: "Ethereum", chainId: 1, color: "#627EEA" },
  { id: "arbitrum", name: "Arbitrum", chainId: 42161, color: "#28A0F0" },
  { id: "polygon", name: "Polygon", chainId: 137, color: "#8247E5" },
];

const tokens = [
  { id: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { id: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
];

// Helper to generate payment header
function generatePaymentHeader(config: PaymentConfig): string {
  const chain = chains.find((c) => c.id === config.chain);
  const token = tokens.find((t) => t.id === config.token);

  const payload = {
    version: "1",
    accepts: [
      {
        scheme: "exact",
        network: `eip155:${chain?.chainId || 8453}`,
        maxAmountRequired: (parseFloat(config.price.replace("$", "")) * 1000000).toString(),
        resource: config.resource,
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
        token: token?.address || tokens[0].address,
      },
    ],
  };

  return JSON.stringify(payload, null, 2);
}

// Copy button component
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
      className="flex h-7 w-7 items-center justify-center rounded-md bg-background-elevated text-foreground-tertiary transition-colors hover:bg-border hover:text-foreground"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <CheckIcon className="text-brand" /> : <CopyIcon />}
    </button>
  );
}

// Step indicator component
function StepIndicator({ step, isActive, isCompleted }: { step: Step; isActive: boolean; isCompleted: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
          isCompleted
            ? "bg-brand text-background"
            : isActive
            ? "bg-brand/20 text-brand"
            : "bg-background-tertiary text-foreground-tertiary"
        }`}
      >
        {isCompleted ? <CheckIcon className="h-4 w-4" /> : step.id}
      </div>
      <div>
        <p className={`text-sm font-medium ${isActive || isCompleted ? "text-foreground" : "text-foreground-tertiary"}`}>
          {step.title}
        </p>
        <p className="text-xs text-foreground-tertiary">{step.description}</p>
      </div>
    </div>
  );
}

// Code block component
function CodeBlock({ code, language, title }: { code: string; language: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background-tertiary">
      <div className="flex items-center justify-between border-b border-border bg-background-secondary px-4 py-2">
        <span className="text-xs font-medium text-foreground-tertiary">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-xs leading-relaxed text-foreground-secondary">{code}</code>
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

    // Step 1: Client request
    await new Promise((r) => setTimeout(r, 800));
    setCurrentStep(1);

    // Step 2: 402 Response
    await new Promise((r) => setTimeout(r, 1000));
    setCurrentStep(2);
    setShowResponse(true);

    // Step 3: User pays
    await new Promise((r) => setTimeout(r, 1200));
    setCurrentStep(3);

    // Step 4: Verified access
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

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Interactive Playground
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
          See how t402 payments work in real-time. Configure your payment settings and watch
          the HTTP 402 flow in action.
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Configuration Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-1"
        >
          <div className="sticky top-24 space-y-6">
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Configuration</h2>

              {/* Endpoint */}
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">
                  Endpoint
                </label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Method */}
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">
                  Method
                </label>
                <select
                  value={config.method}
                  onChange={(e) => setConfig({ ...config, method: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              {/* Price */}
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">
                  Price
                </label>
                <input
                  type="text"
                  value={config.price}
                  onChange={(e) => setConfig({ ...config, price: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Chain */}
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">
                  Chain
                </label>
                <select
                  value={config.chain}
                  onChange={(e) => setConfig({ ...config, chain: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Token */}
              <div className="mb-6">
                <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">
                  Token
                </label>
                <select
                  value={config.token}
                  onChange={(e) => setConfig({ ...config, token: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {tokens.map((token) => (
                    <option key={token.id} value={token.id}>
                      {token.id} - {token.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resource */}
              <div className="mb-6">
                <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">
                  Resource Description
                </label>
                <input
                  type="text"
                  value={config.resource}
                  onChange={(e) => setConfig({ ...config, resource: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={runDemo}
                  disabled={isRunning}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-brand-secondary disabled:opacity-50"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isRunning ? "Running..." : "Run Demo"}
                </button>
                <button
                  onClick={resetDemo}
                  className="flex items-center justify-center rounded-lg border border-border bg-background-tertiary px-3 py-2.5 text-foreground-secondary transition-colors hover:bg-border hover:text-foreground"
                >
                  <RefreshIcon />
                </button>
              </div>
            </div>

            {/* Step Progress */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Payment Flow</h3>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <StepIndicator
                    key={step.id}
                    step={step}
                    isActive={currentStep === index + 1}
                    isCompleted={currentStep > index + 1}
                  />
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
            {/* Step 1: Client Request */}
            <div
              className={`rounded-xl border p-6 transition-all ${
                currentStep >= 1
                  ? "border-brand/50 bg-brand/5"
                  : "border-border bg-background-secondary"
              }`}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                  <ServerIcon className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">1. Client Request</h3>
                  <p className="text-sm text-foreground-tertiary">
                    Client makes HTTP request to protected endpoint
                  </p>
                </div>
              </div>
              <CodeBlock code={requestCode} language="javascript" title="request.js" />
            </div>

            {/* Step 2: 402 Response */}
            <AnimatePresence>
              {(currentStep >= 2 || showResponse) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`rounded-xl border p-6 transition-all ${
                    currentStep >= 2
                      ? "border-yellow-500/50 bg-yellow-500/5"
                      : "border-border bg-background-secondary"
                  }`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                      <span className="text-lg font-bold text-yellow-500">402</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">2. Payment Required</h3>
                      <p className="text-sm text-foreground-tertiary">
                        Server returns 402 with payment instructions
                      </p>
                    </div>
                  </div>
                  <CodeBlock code={responseCode} language="http" title="response" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3: Payment */}
            <AnimatePresence>
              {currentStep >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="rounded-xl border border-purple-500/50 bg-purple-500/5 p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                      <WalletIcon className="text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">3. User Signs Payment</h3>
                      <p className="text-sm text-foreground-tertiary">
                        Wallet signs payment authorization (gasless)
                      </p>
                    </div>
                  </div>
                  <CodeBlock code={paymentCode} language="javascript" title="payment.js" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 4: Success */}
            <AnimatePresence>
              {currentStep >= 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="rounded-xl border border-brand/50 bg-brand/5 p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/20">
                      <CheckCircleIcon className="text-brand" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">4. Access Granted</h3>
                      <p className="text-sm text-foreground-tertiary">
                        Payment verified, content delivered
                      </p>
                    </div>
                  </div>
                  <CodeBlock code={successCode} language="http" title="success response" />

                  {/* Success message */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 rounded-lg bg-brand/10 p-4"
                  >
                    <p className="text-center text-sm font-medium text-brand">
                      Payment complete! User received access to {config.resource}
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Quick Start CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-16 rounded-2xl border border-border bg-background-secondary p-8 text-center sm:p-12"
      >
        <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
          Ready to integrate?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
          Add t402 payments to your API in minutes. Our SDKs handle all the complexity -
          you just define your pricing.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/sdks"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium text-background transition-colors hover:bg-brand-secondary"
          >
            View SDKs
            <ArrowRightIcon />
          </Link>
          <Link
            href="https://docs.t402.io/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
          >
            Quickstart Guide
            <ExternalLinkIcon />
          </Link>
        </div>
      </motion.div>

      {/* Info Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-12 grid gap-6 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-border bg-background-secondary p-6">
          <h3 className="mb-2 font-semibold text-foreground">HTTP Native</h3>
          <p className="text-sm text-foreground-secondary">
            Uses standard HTTP 402 status code. Works with any HTTP client, any programming language.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-6">
          <h3 className="mb-2 font-semibold text-foreground">Gasless Payments</h3>
          <p className="text-sm text-foreground-secondary">
            Users sign a message, not a transaction. No gas fees required for EIP-3009 compatible tokens.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-6">
          <h3 className="mb-2 font-semibold text-foreground">Instant Settlement</h3>
          <p className="text-sm text-foreground-secondary">
            Payments are verified and settled in real-time. No waiting for confirmations on supported chains.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
