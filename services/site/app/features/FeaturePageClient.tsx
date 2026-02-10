"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { type Feature } from "./data";

// Icons
function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
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
      style={style}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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

function ArrowLeftIcon({ className = "" }: { className?: string }) {
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
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function GaslessIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function BridgeIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function MCPIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function MultisigIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  );
}

function PolicyIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function A2AIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <circle cx="7" cy="12" r="3" />
      <circle cx="17" cy="12" r="3" />
      <path d="M10 12h4" />
      <path d="m14 10 2 2-2 2" />
    </svg>
  );
}

function StreamingIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M2 12h4" />
      <path d="M8 12h4" />
      <path d="M14 12h4" />
      <path d="M20 12h2" />
      <path d="m6 8 2 4-2 4" />
      <path d="m12 8 2 4-2 4" />
      <path d="m18 8 2 4-2 4" />
    </svg>
  );
}

function ZKIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20" />
      <path d="M12 6v6l4 2" />
      <path d="M8 14l4-4" />
    </svg>
  );
}

function RouterIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function IntentIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M4 4h16v16H4z" />
      <path d="M9 9h6v6H9z" />
      <path d="M4 12h5" />
      <path d="M15 12h5" />
      <path d="M12 4v5" />
      <path d="M12 15v5" />
    </svg>
  );
}

const iconMap: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  gasless: GaslessIcon,
  bridge: BridgeIcon,
  mcp: MCPIcon,
  multisig: MultisigIcon,
  policy: PolicyIcon,
  a2a: A2AIcon,
  streaming: StreamingIcon,
  zk: ZKIcon,
  router: RouterIcon,
  intent: IntentIcon,
};

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
      className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
      style={{
        background: "rgba(255,255,255,0.1)",
        color: copied ? "#50AF95" : "#A1A1AA",
      }}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <CheckIcon style={{ color: "#50AF95" }} /> : <CopyIcon />}
    </button>
  );
}

function CodeBlock({ code, title }: { code: string; title: string }) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "#18181B", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="text-sm font-medium" style={{ color: "#FAFAFA" }}>{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-5">
        <code className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>{code}</code>
      </pre>
    </div>
  );
}

export default function FeaturePageClient({ feature }: { feature: Feature }) {
  const Icon = iconMap[feature.icon] || GaslessIcon;

  return (
    <>
      {/* Hero Section - Dark */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          {/* Breadcrumb / Back */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-12"
          >
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-sm transition-colors"
              style={{ color: "#A1A1AA" }}
            >
              <ArrowLeftIcon />
              All Features
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-start gap-8 md:flex-row md:items-center"
          >
            {/* Icon */}
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${feature.color}20` }}
            >
              <Icon style={{ color: feature.color }} />
            </div>

            {/* Title block */}
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
                  {feature.name}
                </h1>
                {feature.badge && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider"
                    style={{
                      background: feature.badge === "beta"
                        ? "rgba(245, 158, 11, 0.15)"
                        : feature.badge === "coming-soon"
                          ? "rgba(168, 85, 247, 0.15)"
                          : "rgba(16, 185, 129, 0.15)",
                      color: feature.badge === "beta"
                        ? "#F59E0B"
                        : feature.badge === "coming-soon"
                          ? "#A855F7"
                          : "#10B981",
                    }}
                  >
                    {feature.badge}
                  </span>
                )}
              </div>
              <p className="mb-3 text-xl font-medium" style={{ color: feature.color }}>
                {feature.tagline}
              </p>
              <p className="max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
                {feature.description}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits - Light Section */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Advantages
            </span>
            <h2 className="mt-4 mb-10 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#1A1A2E" }}>
              Benefits
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {feature.benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card-elevated p-8"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${feature.color}15` }}
                  >
                    <CheckIcon style={{ color: feature.color }} />
                  </span>
                  <h3 className="text-lg font-semibold" style={{ color: "#1A1A2E" }}>
                    {benefit.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#4A5568" }}>
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Details - Dark Alt Section */}
      <section className="section-dark-alt py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-5">
            {/* Technical details - left 3 cols */}
            <div className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                  Under the Hood
                </span>
                <h2 className="mt-4 mb-10 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
                  Technical Details
                </h2>
              </motion.div>

              <div className="space-y-4">
                {feature.technicalDetails.map((detail, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="rounded-2xl p-6"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <h3 className="mb-2 font-semibold" style={{ color: "#FAFAFA" }}>
                      {detail.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
                      {detail.content}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Sidebar - right 2 cols */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="sticky top-24 space-y-6"
              >
                {/* Supported Chains */}
                <div
                  className="rounded-2xl p-6"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: "#FAFAFA" }}>
                    Supported Chains
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {feature.supportedChains.map((chain) => (
                      <span
                        key={chain}
                        className="rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ background: "rgba(80, 175, 149, 0.1)", color: "#50AF95" }}
                      >
                        {chain}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quick Links */}
                <div
                  className="rounded-2xl p-6"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: "#FAFAFA" }}>
                    Quick Links
                  </h3>
                  <div className="space-y-3">
                    <Link
                      href={feature.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                      style={{ color: "#A1A1AA" }}
                    >
                      <ExternalLinkIcon />
                      Documentation
                    </Link>
                    <Link
                      href="/sdks"
                      className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                      style={{ color: "#A1A1AA" }}
                    >
                      <ExternalLinkIcon className="opacity-0" />
                      View SDKs
                    </Link>
                    <Link
                      href="/chains"
                      className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                      style={{ color: "#A1A1AA" }}
                    >
                      <ExternalLinkIcon className="opacity-0" />
                      Supported Chains
                    </Link>
                  </div>
                </div>

                {/* CTA Card */}
                <div
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: `${feature.color}10`, border: `1px solid ${feature.color}30` }}
                >
                  <h3 className="mb-2 font-semibold" style={{ color: "#FAFAFA" }}>
                    Ready to implement?
                  </h3>
                  <p className="mb-4 text-sm" style={{ color: "#A1A1AA" }}>
                    Get started with our quickstart guide and have {feature.name.toLowerCase()} working
                    in minutes.
                  </p>
                  <Link
                    href="https://docs.t402.io/getting-started/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: feature.color, color: "#0A0A0B" }}
                  >
                    Get Started
                    <ExternalLinkIcon />
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example - Light Alt Section */}
      {feature.codeExample && (
        <section className="section-light-alt py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                Implementation
              </span>
              <h2 className="mt-4 mb-10 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#1A1A2E" }}>
                Code Example
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto max-w-4xl"
            >
              <CodeBlock code={feature.codeExample.code} title={feature.codeExample.title} />
            </motion.div>
          </div>
        </section>
      )}

      {/* Use Cases - Dark Section */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Applications
            </span>
            <h2 className="mt-4 mb-10 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Use Cases
            </h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {feature.useCases.map((useCase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card-elevated-dark flex items-start gap-4 p-6"
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${feature.color}20`, color: feature.color }}
                >
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
                  {useCase}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Light Alt Section */}
      <section className="section-light-alt py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#1A1A2E" }}>
              Start building with {feature.name}
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg" style={{ color: "#4A5568" }}>
              Check out the documentation for detailed implementation guides and API references.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href={feature.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:opacity-90"
                style={{ background: "#50AF95", color: "#0A0A0B" }}
              >
                Read Documentation
                <ExternalLinkIcon />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold transition-all"
                style={{ border: "1px solid rgba(0,0,0,0.1)", color: "#1A1A2E" }}
              >
                All Features
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
