"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Fuel, ArrowLeftRight, Shield, CreditCard } from "lucide-react";

const features = [
  {
    id: "gasless",
    icon: Fuel,
    label: "Gasless",
    tagline: "ERC-4337 Account Abstraction",
    color: "#10B981",
    description: "Zero gas fees for users. EIP-3009 TransferWithAuthorization enables off-chain signatures. ERC-4337 smart accounts with paymasters handle gas on 19+ EVM chains.",
    chains: ["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Ink", "Berachain", "Unichain", "+11 more"],
    code: `import { createGaslessTransfer } from "@t402/wdk-gasless";

// User signs an EIP-3009 authorization (no gas needed)
const authorization = await createGaslessTransfer({
  token: "USDT0",
  from: userAddress,
  to: merchantAddress,
  amount: "10.00",
  network: "eip155:8453", // Base
  deadline: Math.floor(Date.now() / 1000) + 3600,
});

// Facilitator submits the transaction on-chain
const result = await facilitator.settle(authorization);`,
    diagram: ["User signs", "Bundler submits", "Paymaster pays gas", "Settlement complete"],
  },
  {
    id: "bridge",
    icon: ArrowLeftRight,
    label: "Bridge",
    tagline: "LayerZero USDT0 Cross-Chain",
    color: "#8B5CF6",
    description: "Bridge USDT0 seamlessly between 19+ chains using LayerZero OFT standard. Same token, any chain, unified liquidity without wrapped tokens.",
    chains: ["Ethereum", "Arbitrum", "Base", "Optimism", "Ink", "Berachain", "Unichain", "+12 more"],
    code: `import { bridge } from "@t402/wdk-bridge";

const result = await bridge({
  token: "USDT0",
  from: {
    network: "eip155:42161", // Arbitrum
    address: userAddress,
  },
  to: {
    network: "eip155:8453", // Base
    address: userAddress,
  },
  amount: "100.00",
});

console.log("Bridge initiated:", result.srcTxHash);`,
    diagram: ["Lock on source", "LayerZero message", "Mint on destination", "Transfer complete"],
  },
  {
    id: "multisig",
    icon: Shield,
    label: "Multisig",
    tagline: "Safe Multi-Signature",
    color: "#EC4899",
    description: "Accept payments to Safe multi-signature wallets. Configure M-of-N signing requirements for enterprise-grade security and team treasury management.",
    chains: ["Ethereum", "Arbitrum", "Optimism", "Polygon", "Base", "Berachain", "Unichain"],
    code: `import { ExactEvmServer } from "@t402/evm/exact/server";

app.use(paymentMiddleware({
  "GET /api/premium": {
    price: "$100.00",
    network: "eip155:8453",
    schemes: [
      new ExactEvmServer({
        // Safe multisig address (2-of-3)
        payTo: "0xSafeAddress...",
      }),
    ],
  },
}));`,
    diagram: ["Payment received", "2-of-3 signers approve", "Safe executes", "Funds secured"],
  },
  {
    id: "paywall",
    icon: CreditCard,
    label: "Paywall",
    tagline: "Universal Payment UI",
    color: "#F59E0B",
    description: "Drop-in paywall component supporting 7+ chain families. Auto-generates wallet connection and payment UI. Works with React, Vue, and vanilla JS.",
    chains: ["EVM", "Solana", "TON", "TRON", "Stacks", "Cosmos", "NEAR"],
    code: `import { PaywallBuilder } from "@t402/paywall";
import { evmPaywall } from "@t402/paywall/evm";
import { svmPaywall } from "@t402/paywall/svm";
import { tonPaywall } from "@t402/paywall/ton";

const paywall = new PaywallBuilder()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .withNetwork(tonPaywall)
  .withConfig({
    appName: "My App",
    theme: { mode: "dark" }
  })
  .build();`,
    diagram: ["Show paywall", "Connect wallet", "Sign authorization", "Access granted"],
  },
];

export default function AdvancedSection() {
  const [activeFeature, setActiveFeature] = useState(0);
  const feature = features[activeFeature];
  const Icon = feature.icon;

  return (
    <div className="flex h-full flex-col p-6">
      {/* Feature cards */}
      <div className="flex gap-3 mb-6">
        {features.map((f, i) => {
          const FIcon = f.icon;
          const isActive = activeFeature === i;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFeature(i)}
              className={`relative flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
                isActive ? "border-white/10 bg-white/5" : "border-[var(--color-border)] hover:border-white/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <FIcon size={16} style={{ color: f.color }} />
                <span className="text-sm font-medium text-white">{f.label}</span>
              </div>
              <div className="text-xs text-[var(--color-muted)]">{f.tagline}</div>
              {isActive && (
                <motion.div
                  layoutId="advanced-active"
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ backgroundColor: f.color }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="flex flex-1 gap-6 overflow-hidden"
        >
          {/* Left: Description + Diagram */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${feature.color}15` }}>
                <Icon size={20} style={{ color: feature.color }} />
              </div>
              <div>
                <h3 className="text-[var(--text-heading)] font-bold text-white">{feature.label}</h3>
                <p className="text-xs text-[var(--color-muted)]">{feature.tagline}</p>
              </div>
            </div>

            <p className="text-sm text-white/70 mb-5 leading-relaxed">{feature.description}</p>

            {/* Flow diagram */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-4">
              <div className="text-xs text-[var(--color-muted)] mb-3">How it works</div>
              <div className="flex items-center gap-2">
                {feature.diagram.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className="flex-1 rounded-lg bg-[var(--color-code-bg)] px-3 py-2 text-center">
                      <div className="text-[10px] text-[var(--color-muted)] mb-0.5">{i + 1}</div>
                      <div className="text-xs text-white/80">{step}</div>
                    </div>
                    {i < feature.diagram.length - 1 && (
                      <div className="text-[var(--color-muted)]">→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Supported chains */}
            <div className="flex flex-wrap gap-1.5">
              {feature.chains.map((chain) => (
                <span key={chain} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {chain}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Code */}
          <div className="w-[420px] shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] flex flex-col">
            <div className="border-b border-[var(--color-border)] px-4 py-2">
              <span className="text-xs" style={{ color: feature.color }}>Code Example</span>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[var(--text-code)] text-gray-300 leading-relaxed">
              <code>{feature.code}</code>
            </pre>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
