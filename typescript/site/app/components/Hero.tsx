"use client";

import Link from "next/link";
import { motion } from "motion/react";

// Chain logo components
function EthereumLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Ethereum">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path
        d="M16.498 4v8.87l7.497 3.35L16.498 4z"
        fill="#fff"
        fillOpacity="0.6"
      />
      <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff" />
      <path
        d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z"
        fill="#fff"
        fillOpacity="0.6"
      />
      <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff" />
      <path
        d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z"
        fill="#fff"
        fillOpacity="0.2"
      />
      <path
        d="M9 16.22l7.498 4.353v-7.701L9 16.22z"
        fill="#fff"
        fillOpacity="0.6"
      />
    </svg>
  );
}

function BaseLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Base">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path
        d="M16 26c5.523 0 10-4.477 10-10S21.523 6 16 6c-5.22 0-9.48 3.997-9.962 9.1h13.13v1.8H6.038C6.52 22.003 10.78 26 16 26z"
        fill="#fff"
      />
    </svg>
  );
}

function ArbitrumLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Arbitrum">
      <circle cx="16" cy="16" r="16" fill="#28A0F0" />
      <path d="M16 6l8 14h-16l8-14z" fill="#fff" />
      <path d="M16 26l-8-6h16l-8 6z" fill="#fff" fillOpacity="0.6" />
    </svg>
  );
}

function TonLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="TON">
      <circle cx="16" cy="16" r="16" fill="#0098EA" />
      <path
        d="M22.4 10.4H9.6c-.9 0-1.4 1-1 1.7l7.1 11.2c.2.3.6.3.8 0l7.1-11.2c.4-.7-.1-1.7-1.2-1.7zm-8.3 2.3h3.8v6.8l-3.8-6.8zm5.6 0h3.8l-3.8 6.8v-6.8z"
        fill="#fff"
      />
    </svg>
  );
}

function TronLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="TRON">
      <circle cx="16" cy="16" r="16" fill="#FF0000" />
      <path
        d="M22.8 9.6L9.2 12.8l8 10.4 5.6-13.6zm-11.6 3l8-2-4.4 8.4-3.6-6.4zm8.8-1l-3.6 8.8 4.8-7.6-1.2-1.2z"
        fill="#fff"
      />
    </svg>
  );
}

function SolanaLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Solana">
      <circle cx="16" cy="16" r="16" fill="#9945FF" />
      <path
        d="M10 19.5l2-2h10l-2 2H10zm0-5l2 2h10l-2-2H10zm0-3l2-2h10l-2 2H10z"
        fill="#fff"
      />
    </svg>
  );
}

function PolygonLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Polygon">
      <circle cx="16" cy="16" r="16" fill="#8247E5" />
      <path
        d="M21 13.5l-3-1.7-3 1.7v3.5l3 1.7 3-1.7v-3.5zm-6 6.8l-3-1.7v-3.5l3 1.7v3.5zm0-10.6l-3 1.7v3.5l3-1.7V9.7zm6 10.6l-3 1.7v-3.5l3-1.7v3.5z"
        fill="#fff"
      />
    </svg>
  );
}

const chainLogos = [
  { name: "Ethereum", Logo: EthereumLogo },
  { name: "Base", Logo: BaseLogo },
  { name: "Arbitrum", Logo: ArbitrumLogo },
  { name: "Polygon", Logo: PolygonLogo },
  { name: "TON", Logo: TonLogo },
  { name: "TRON", Logo: TronLogo },
  { name: "Solana", Logo: SolanaLogo },
];

const codeExample = `// Accept USDT payments in 3 lines
import { t402 } from "@t402/sdk";

const payment = await t402.verify(request);`;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(80, 175, 149, 0.15), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-background-secondary px-4 py-1.5"
          >
            <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
            <span className="text-sm text-foreground-secondary">
              Now supporting TON blockchain
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            The Official Payment Protocol
            <br />
            <span className="text-gradient">for USDT</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-foreground-secondary sm:text-xl"
          >
            HTTP-native stablecoin payments across Ethereum, TON, TRON, and
            Solana. Zero fees. Instant settlement. Built for AI agents.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="https://docs.t402.io/quickstart"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-brand px-6 text-base font-medium text-background transition-all hover:bg-brand-secondary hover:shadow-glow"
            >
              Get Started
            </Link>
            <Link
              href="https://docs.t402.io"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background-secondary px-6 text-base font-medium text-foreground transition-colors hover:bg-background-tertiary"
            >
              View Documentation
            </Link>
          </motion.div>

          {/* Code Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16"
          >
            <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-background-secondary shadow-xl">
              {/* Window Header */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-error" />
                <div className="h-3 w-3 rounded-full bg-warning" />
                <div className="h-3 w-3 rounded-full bg-success" />
                <span className="ml-2 font-mono text-xs text-foreground-tertiary">
                  payment.ts
                </span>
              </div>
              {/* Code */}
              <pre className="overflow-x-auto border-none bg-transparent p-6 text-left">
                <code className="bg-transparent font-mono text-sm leading-relaxed">
                  <span className="text-foreground-tertiary">
                    {"// Accept USDT payments in 3 lines"}
                  </span>
                  {"\n"}
                  <span className="text-[#C586C0]">import</span>
                  <span className="text-foreground"> {"{ "}</span>
                  <span className="text-[#9CDCFE]">t402</span>
                  <span className="text-foreground">{" }"} </span>
                  <span className="text-[#C586C0]">from</span>
                  <span className="text-[#CE9178]"> "@t402/sdk"</span>
                  <span className="text-foreground">;</span>
                  {"\n\n"}
                  <span className="text-[#569CD6]">const</span>
                  <span className="text-[#9CDCFE]"> payment</span>
                  <span className="text-foreground"> = </span>
                  <span className="text-[#C586C0]">await</span>
                  <span className="text-[#DCDCAA]"> t402</span>
                  <span className="text-foreground">.</span>
                  <span className="text-[#DCDCAA]">verify</span>
                  <span className="text-foreground">(</span>
                  <span className="text-[#9CDCFE]">request</span>
                  <span className="text-foreground">);</span>
                </code>
              </pre>
            </div>
          </motion.div>

          {/* Supported Chains */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-16"
          >
            <p className="mb-6 text-sm font-medium uppercase tracking-wider text-foreground-tertiary">
              Supported Chains
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {chainLogos.map(({ name, Logo }) => (
                <div
                  key={name}
                  className="group flex flex-col items-center gap-2"
                >
                  <Logo className="h-10 w-10 opacity-60 transition-all group-hover:opacity-100 group-hover:scale-110" />
                  <span className="text-xs text-foreground-tertiary opacity-0 transition-opacity group-hover:opacity-100">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
