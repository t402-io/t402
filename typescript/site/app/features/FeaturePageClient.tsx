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

const iconMap: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  gasless: GaslessIcon,
  bridge: BridgeIcon,
  mcp: MCPIcon,
  multisig: MultisigIcon,
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
      className="flex h-8 w-8 items-center justify-center rounded-md bg-background-elevated text-foreground-secondary transition-colors hover:bg-border hover:text-foreground"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <CheckIcon className="text-brand" /> : <CopyIcon />}
    </button>
  );
}

function CodeBlock({ code, title }: { code: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background-tertiary">
      <div className="flex items-center justify-between border-b border-border bg-background-secondary px-4 py-3">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm leading-relaxed text-foreground-secondary">{code}</code>
      </pre>
    </div>
  );
}

export default function FeaturePageClient({ feature }: { feature: Feature }) {
  const Icon = iconMap[feature.icon] || GaslessIcon;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <Link
          href="/features"
          className="inline-flex items-center gap-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon />
          All Features
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16"
      >
        <div className="flex items-start gap-6">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${feature.color}20` }}
          >
            <Icon style={{ color: feature.color }} />
          </div>
          <div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {feature.name}
            </h1>
            <p className="mb-4 text-xl font-medium" style={{ color: feature.color }}>
              {feature.tagline}
            </p>
            <p className="max-w-2xl text-lg text-foreground-secondary">{feature.description}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Benefits */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-12"
          >
            <h2 className="mb-6 text-2xl font-semibold text-foreground">Benefits</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {feature.benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-border bg-background-secondary p-6"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${feature.color}20` }}
                    >
                      <CheckIcon className="h-3.5 w-3.5" style={{ color: feature.color }} />
                    </span>
                    <h3 className="font-semibold text-foreground">{benefit.title}</h3>
                  </div>
                  <p className="text-sm text-foreground-secondary">{benefit.description}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Technical Details */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-12"
          >
            <h2 className="mb-6 text-2xl font-semibold text-foreground">Technical Details</h2>
            <div className="space-y-4">
              {feature.technicalDetails.map((detail, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-border bg-background-secondary p-6"
                >
                  <h3 className="mb-2 font-semibold text-foreground">{detail.title}</h3>
                  <p className="text-sm text-foreground-secondary">{detail.content}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Code Example */}
          {feature.codeExample && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-12"
            >
              <h2 className="mb-6 text-2xl font-semibold text-foreground">Code Example</h2>
              <CodeBlock code={feature.codeExample.code} title={feature.codeExample.title} />
            </motion.section>
          )}

          {/* Use Cases */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="mb-6 text-2xl font-semibold text-foreground">Use Cases</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {feature.useCases.map((useCase, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-4"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: `${feature.color}20`, color: feature.color }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground-secondary">{useCase}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="sticky top-24 space-y-6"
          >
            {/* Supported Chains */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <h3 className="mb-4 font-semibold text-foreground">Supported Chains</h3>
              <div className="flex flex-wrap gap-2">
                {feature.supportedChains.map((chain) => (
                  <span
                    key={chain}
                    className="rounded-md bg-background-tertiary px-3 py-1.5 text-sm text-foreground-secondary"
                  >
                    {chain}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <h3 className="mb-4 font-semibold text-foreground">Quick Links</h3>
              <div className="space-y-3">
                <Link
                  href={feature.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
                >
                  <ExternalLinkIcon />
                  Documentation
                </Link>
                <Link
                  href="/sdks"
                  className="flex items-center gap-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
                >
                  <ExternalLinkIcon className="opacity-0" />
                  View SDKs
                </Link>
                <Link
                  href="/chains"
                  className="flex items-center gap-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
                >
                  <ExternalLinkIcon className="opacity-0" />
                  Supported Chains
                </Link>
              </div>
            </div>

            {/* CTA */}
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: `${feature.color}10`, borderColor: feature.color }}
            >
              <h3 className="mb-2 font-semibold text-foreground">Ready to implement?</h3>
              <p className="mb-4 text-sm text-foreground-secondary">
                Get started with our quickstart guide and have {feature.name.toLowerCase()} working
                in minutes.
              </p>
              <Link
                href="https://docs.t402.io/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                style={{ backgroundColor: feature.color }}
              >
                Get Started
                <ExternalLinkIcon />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
