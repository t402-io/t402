"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
}

type FAQCategory = "general" | "technical" | "pricing" | "security" | "integration";

const categories: { id: FAQCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "technical", label: "Technical" },
  { id: "pricing", label: "Pricing & Fees" },
  { id: "security", label: "Security" },
  { id: "integration", label: "Integration" },
];

const faqs: FAQItem[] = [
  // General
  {
    id: "what-is-t402",
    question: "What is T402?",
    answer:
      "T402 is an open-source payment protocol that enables HTTP-native stablecoin (USDT/USDC) payments across 44 networks. It uses the HTTP 402 'Payment Required' status code to embed payments directly into web requests, allowing services to monetize APIs, content, and AI agent interactions without traditional payment processors.",
    category: "general",
  },
  {
    id: "why-402",
    question: "Why is it called T402?",
    answer:
      "The name comes from HTTP status code 402 'Payment Required', which was reserved in the HTTP/1.1 specification for future use with digital payments. T402 finally implements this vision, using the 402 response to signal payment requirements and the 'T' represents Tether (USDT), the primary stablecoin supported.",
    category: "general",
  },
  {
    id: "who-is-t402-for",
    question: "Who is T402 for?",
    answer:
      "T402 is designed for developers and businesses who want to monetize digital services with stablecoin payments. This includes API providers, content creators, AI/ML service operators, SaaS platforms, and anyone building applications where AI agents need to make autonomous payments.",
    category: "general",
  },
  {
    id: "which-chains",
    question: "Which blockchains are supported?",
    answer:
      "T402 supports 44 networks across 10 families: EVM chains (Ethereum, Base, Arbitrum, Optimism, Polygon, etc.), Solana, TON (Telegram), TRON, NEAR, Aptos, Tezos, Polkadot Asset Hub, Stacks (Bitcoin L2), and Cosmos/Noble. Each chain uses its native token standard for USDT/USDC.",
    category: "general",
  },
  {
    id: "open-source",
    question: "Is T402 open source?",
    answer:
      "Yes, T402 is fully open source under the Apache 2.0 license. All SDKs (TypeScript, Python, Go, Java), the facilitator service, and documentation are available on GitHub at github.com/t402-io/t402. You can self-host the entire infrastructure or use our hosted facilitator service.",
    category: "general",
  },

  // Technical
  {
    id: "how-it-works",
    question: "How does T402 work?",
    answer:
      "When a client requests a paid resource, the server responds with HTTP 402 and payment requirements in headers. The client signs a payment authorization using their wallet, then retries the request with the signed payment in the X-PAYMENT header. The server verifies the signature and, if valid, settles the payment on-chain via a facilitator before returning the resource.",
    category: "technical",
  },
  {
    id: "what-is-facilitator",
    question: "What is the facilitator?",
    answer:
      "The facilitator is a service that verifies payment signatures and executes on-chain settlement. It holds the private keys needed to call transferWithAuthorization (EIP-3009) or equivalent functions on other chains. You can use the hosted facilitator at facilitator.t402.io or run your own.",
    category: "technical",
  },
  {
    id: "gasless-how",
    question: "How do gasless transactions work?",
    answer:
      "On EVM chains, T402 uses EIP-3009 (transferWithAuthorization) which allows users to sign a message authorizing a transfer. The facilitator then submits this signed authorization on-chain, paying the gas fees. Users only need USDT - no ETH or other native tokens required. This is supported on all 19 USDT0 networks.",
    category: "technical",
  },
  {
    id: "mcp-support",
    question: "What is MCP support?",
    answer:
      "MCP (Model Context Protocol) is Anthropic's protocol for AI agents to use tools. T402's @t402/mcp package implements an MCP server that allows AI agents like Claude to make payments autonomously. When an agent tries to use a paid tool, it receives a 402 error with payment requirements, can sign a payment, and retry.",
    category: "technical",
  },
  {
    id: "a2a-support",
    question: "What is A2A support?",
    answer:
      "A2A (Agent-to-Agent) is Google's protocol for autonomous agent communication. T402 supports A2A transport, allowing agents to discover paid services, negotiate prices, and settle payments within multi-agent workflows. This enables agent-to-agent commerce where AI agents can buy and sell services from each other.",
    category: "technical",
  },
  {
    id: "replay-protection",
    question: "How is replay protection handled?",
    answer:
      "Each chain uses different replay protection mechanisms: EVM uses random nonces + deadlines (EIP-3009), Solana uses recent blockhash, TON uses query_id, TRON uses Protobuf nonces, etc. T402 SDKs handle this automatically - you don't need to manage nonces manually.",
    category: "technical",
  },

  // Pricing
  {
    id: "fees",
    question: "What are the fees?",
    answer:
      "T402 protocol itself has zero fees - there are no percentage cuts or flat fees on transactions. The only costs are blockchain gas fees for on-chain settlement, which vary by chain. On L2s like Base or Arbitrum, these are typically under $0.01. The facilitator service (facilitator.t402.io) is currently free to use.",
    category: "pricing",
  },
  {
    id: "compare-stripe",
    question: "How does T402 compare to Stripe?",
    answer:
      "Stripe charges 2.9% + $0.30 per transaction with 2-7 day settlement. T402 has 0% fees with instant settlement. However, Stripe supports fiat currencies and has broader merchant tools. T402 is ideal for crypto-native payments, AI agents, and cases where instant settlement and zero fees matter more than fiat support.",
    category: "pricing",
  },
  {
    id: "minimum-payment",
    question: "Is there a minimum payment amount?",
    answer:
      "There's no protocol-enforced minimum. However, practical minimums depend on gas costs. On expensive chains like Ethereum mainnet, micropayments under $1 may not be economical. On L2s (Base, Arbitrum) or other chains (TON, TRON), payments as low as $0.001 are practical.",
    category: "pricing",
  },

  // Security
  {
    id: "security-model",
    question: "What is the security model?",
    answer:
      "Users sign payment authorizations with their own private keys - keys never leave the client. The facilitator only receives signed messages and executes them on-chain. Payments use chain-specific signature standards (EIP-712, Ed25519, etc.) with replay protection. The protocol is non-custodial.",
    category: "security",
  },
  {
    id: "chargebacks",
    question: "Are there chargebacks?",
    answer:
      "No. Unlike credit card payments, stablecoin transfers are final and irreversible. Once a payment is settled on-chain, it cannot be reversed. This eliminates chargeback fraud risk for merchants but also means refunds must be handled manually if needed.",
    category: "security",
  },
  {
    id: "kyc-required",
    question: "Is KYC required?",
    answer:
      "T402 itself doesn't require KYC - anyone can start accepting payments immediately. However, depending on your jurisdiction and business type, you may have regulatory obligations. The protocol is neutral infrastructure; compliance is the responsibility of the service operator.",
    category: "security",
  },
  {
    id: "audit",
    question: "Has T402 been audited?",
    answer:
      "The T402 protocol and SDKs are open source and available for review on GitHub. The facilitator service uses standard token transfer functions (EIP-3009, SPL transfers, etc.) without custom smart contracts. We recommend reviewing the code and conducting your own security assessment for production deployments.",
    category: "security",
  },

  // Integration
  {
    id: "get-started",
    question: "How do I get started?",
    answer:
      "Install an SDK (npm install @t402/core @t402/evm for TypeScript), add payment middleware to your API routes, configure your wallet address, and you're ready to accept payments. The quickstart guide at docs.t402.io walks through a complete integration in under 5 minutes.",
    category: "integration",
  },
  {
    id: "sdk-languages",
    question: "Which programming languages are supported?",
    answer:
      "T402 offers official SDKs for TypeScript/JavaScript, Python, Go, and Java. TypeScript has the most complete ecosystem with 37 packages including React/Vue components. All SDKs support the same 44 networks with identical payment flows.",
    category: "integration",
  },
  {
    id: "frameworks",
    question: "Which web frameworks are supported?",
    answer:
      "TypeScript: Express.js, Hono, Fastify, Next.js. Python: FastAPI, Flask. Go: Gin, Echo. Java: Spring Boot. Each framework has dedicated middleware that handles 402 responses, payment verification, and settlement automatically.",
    category: "integration",
  },
  {
    id: "self-host",
    question: "Can I self-host everything?",
    answer:
      "Yes. The facilitator service is open source and can be self-hosted. You'll need to provide your own private keys for each chain you want to support and run the Go-based facilitator service. This gives you full control over settlement but requires operational expertise.",
    category: "integration",
  },
  {
    id: "testnet",
    question: "Is there a testnet?",
    answer:
      "Yes, each supported chain has testnet support. EVM uses Base Sepolia, Solana uses Devnet, TON uses Testnet, TRON uses Nile, etc. The demo at demo.t402.io lets you test the full payment flow on testnets without real funds.",
    category: "integration",
  },
];

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
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
      className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
      style={{ color: isOpen ? "#50AF95" : "#A1A1AA" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left transition-colors"
      >
        <span className="text-base font-medium pr-4" style={{ color: "#1A1A2E" }}>{item.question}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-base leading-relaxed" style={{ color: "#4A5568" }}>{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQClient() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory | "all">("all");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const filteredFaqs =
    activeCategory === "all" ? faqs : faqs.filter((faq) => faq.category === activeCategory);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      {/* Dark Header */}
      <section style={{ backgroundColor: "#0A0A0B" }} className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p className="uppercase text-xs tracking-widest font-semibold mb-4" style={{ color: "#50AF95" }}>
              Support
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ color: "#FAFAFA" }}>
              Frequently Asked Questions
            </h1>
            <p className="mx-auto max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Everything you need to know about T402. Can&apos;t find an answer?{" "}
              <Link href="https://t.me/t402_community" style={{ color: "#50AF95" }} className="hover:underline">
                Ask in our Telegram
              </Link>
              .
            </p>
          </motion.div>
        </div>
      </section>

      {/* Light FAQ Section */}
      <section style={{ backgroundColor: "#F7FAF9" }} className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6">
          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-12 overflow-x-auto pb-2"
          >
            <div className="flex w-max min-w-full justify-start gap-2 sm:w-auto sm:justify-center">
              <button
                onClick={() => setActiveCategory("all")}
                className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                style={
                  activeCategory === "all"
                    ? { backgroundColor: "#50AF95", color: "#0A0A0B" }
                    : { backgroundColor: "#FFFFFF", color: "#4A5568", border: "1px solid rgba(0,0,0,0.08)" }
                }
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                  style={
                    activeCategory === cat.id
                      ? { backgroundColor: "#50AF95", color: "#0A0A0B" }
                      : { backgroundColor: "#FFFFFF", color: "#4A5568", border: "1px solid rgba(0,0,0,0.08)" }
                  }
                >
                  {cat.label}
                  <span className="ml-1.5 text-xs opacity-70">
                    {faqs.filter((f) => f.category === cat.id).length}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* FAQ List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-2xl p-8"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            {filteredFaqs.map((faq) => (
              <FAQAccordion
                key={faq.id}
                item={faq}
                isOpen={openItems.has(faq.id)}
                onToggle={() => toggleItem(faq.id)}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-2xl p-8 sm:p-12 text-center"
            style={{ backgroundColor: "#F7FAF9", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <h2 className="mb-4 text-2xl font-bold" style={{ color: "#1A1A2E" }}>Still have questions?</h2>
            <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
              Join our community to get help from the T402 team and other developers.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="https://t.me/t402_community"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                Join Telegram
              </Link>
              <Link
                href="https://docs.t402.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                Read Documentation
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
