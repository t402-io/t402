"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { sdks, typescriptPackages, advancedPackages, supportedChains, type SDK, type Package } from "./data";

// Icons
function TypeScriptIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="4" fill="#3178C6" />
      <path
        d="M22.47 24.47v-2.55a2.13 2.13 0 0 0 1.06 1.86 4.22 4.22 0 0 0 2.22.55 4.88 4.88 0 0 0 1.1-.11 2.7 2.7 0 0 0 .86-.36 1.87 1.87 0 0 0 .56-.59 1.57 1.57 0 0 0 .2-.81 1.45 1.45 0 0 0-.24-.84 2.19 2.19 0 0 0-.65-.6 5.47 5.47 0 0 0-.95-.46c-.36-.14-.74-.28-1.14-.43a9.79 9.79 0 0 1-1.35-.59 4.54 4.54 0 0 1-1.08-.77 3.22 3.22 0 0 1-.71-1 3.43 3.43 0 0 1-.26-1.38 3.38 3.38 0 0 1 .38-1.66 3.31 3.31 0 0 1 1-1.17 4.47 4.47 0 0 1 1.49-.69 6.71 6.71 0 0 1 1.8-.23 7.56 7.56 0 0 1 1.71.17 4.35 4.35 0 0 1 1.27.48v2.42a2.77 2.77 0 0 0-.49-.38 3.57 3.57 0 0 0-.61-.29 4 4 0 0 0-.69-.19 3.91 3.91 0 0 0-.72-.07 3.13 3.13 0 0 0-.94.13 2.21 2.21 0 0 0-.71.35 1.62 1.62 0 0 0-.45.53 1.39 1.39 0 0 0-.16.66 1.26 1.26 0 0 0 .19.7 1.83 1.83 0 0 0 .54.52 4.94 4.94 0 0 0 .84.43l1.11.42a12.06 12.06 0 0 1 1.4.61 4.84 4.84 0 0 1 1.12.78 3.29 3.29 0 0 1 .75 1 3.24 3.24 0 0 1 .27 1.38 3.64 3.64 0 0 1-.4 1.76 3.39 3.39 0 0 1-1.08 1.19 4.79 4.79 0 0 1-1.57.68 8 8 0 0 1-1.87.21 7.25 7.25 0 0 1-2-.27 4.72 4.72 0 0 1-1.5-.71zM6 15.13h3.37v9.58h2.63v-9.58h3.37v-2.21H6z"
        fill="#fff"
      />
    </svg>
  );
}

function PythonIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="python-a" x1="12.96" y1="2" x2="22.29" y2="14.54">
          <stop offset="0" stopColor="#387EB8" />
          <stop offset="1" stopColor="#366994" />
        </linearGradient>
        <linearGradient id="python-b" x1="9.71" y1="17.46" x2="19.04" y2="30">
          <stop offset="0" stopColor="#FFE052" />
          <stop offset="1" stopColor="#FFC331" />
        </linearGradient>
      </defs>
      <path
        d="M15.89 2C9.22 2 9.67 5.05 9.67 5.05l.01 3.16h6.34v.95H6.08s-4.26-.48-4.26 6.23 3.72 6.46 3.72 6.46h2.22v-3.11s-.12-3.72 3.66-3.72h6.3s3.54.06 3.54-3.42V5.65S22.04 2 15.89 2zm-3.51 2.11a1.14 1.14 0 1 1 0 2.28 1.14 1.14 0 0 1 0-2.28z"
        fill="url(#python-a)"
      />
      <path
        d="M16.11 30c6.67 0 6.22-3.05 6.22-3.05l-.01-3.16h-6.34v-.95h9.94s4.26.48 4.26-6.23-3.72-6.46-3.72-6.46h-2.22v3.11s.12 3.72-3.66 3.72h-6.3s-3.54-.06-3.54 3.42v5.94S9.96 30 16.11 30zm3.51-2.11a1.14 1.14 0 1 1 0-2.28 1.14 1.14 0 0 1 0 2.28z"
        fill="url(#python-b)"
      />
    </svg>
  );
}

function GoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M3.9 10.31a.19.19 0 0 1-.16-.08.17.17 0 0 1 0-.18c.09-.14 1-1.41 3.06-1.41a4.62 4.62 0 0 1 1.81.37.17.17 0 0 1 .09.23.18.18 0 0 1-.23.09 4.27 4.27 0 0 0-1.67-.35c-1.83 0-2.7 1.17-2.78 1.28a.19.19 0 0 1-.12.05zm24.2 0a.19.19 0 0 0 .16-.08.17.17 0 0 0 0-.18c-.09-.14-1-1.41-3.06-1.41a4.62 4.62 0 0 0-1.81.37.17.17 0 0 0-.09.23.18.18 0 0 0 .23.09 4.27 4.27 0 0 1 1.67-.35c1.83 0 2.7 1.17 2.78 1.28a.19.19 0 0 0 .12.05z"
        fill="#F6D2A2"
      />
      <path
        d="M16 24.28c-4.78 0-8.67-3.58-8.67-8s3.89-8 8.67-8 8.67 3.58 8.67 8-3.89 8-8.67 8z"
        fill="#00ACD7"
      />
      <path
        d="M21.08 13.87a1.28 1.28 0 1 1-1.28-1.28 1.28 1.28 0 0 1 1.28 1.28zm-8.88 0a1.28 1.28 0 1 1-1.28-1.28 1.28 1.28 0 0 1 1.28 1.28z"
        fill="#111"
      />
      <path
        d="M20.84 13.87a.32.32 0 1 1-.32-.32.32.32 0 0 1 .32.32zm-8.88 0a.32.32 0 1 1-.32-.32.32.32 0 0 1 .32.32z"
        fill="#fff"
      />
      <path
        d="M16 20.92a4.35 4.35 0 0 1-3.54-1.78.37.37 0 0 1 .59-.44 3.64 3.64 0 0 0 5.9 0 .37.37 0 0 1 .59.44A4.35 4.35 0 0 1 16 20.92z"
        fill="#111"
      />
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

function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function PackageIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
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
      style={style}
      aria-hidden="true"
    >
      <path d="M16.5 9.4 7.5 4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  typescript: TypeScriptIcon,
  python: PythonIcon,
  go: GoIcon,
};

const packageGroups = [
  { label: "Core", packages: typescriptPackages.filter((p) => ["@t402/core", "@t402/extensions"].includes(p.name)) },
  { label: "Mechanisms", packages: typescriptPackages.filter((p) => ["@t402/evm-core", "@t402/evm", "@t402/svm", "@t402/ton", "@t402/tron", "@t402/near", "@t402/aptos", "@t402/tezos", "@t402/polkadot", "@t402/stacks"].includes(p.name)) },
  { label: "HTTP & Client", packages: typescriptPackages.filter((p) => ["@t402/express", "@t402/hono", "@t402/fastify", "@t402/next", "@t402/fetch", "@t402/axios"].includes(p.name)) },
  { label: "UI", packages: typescriptPackages.filter((p) => ["@t402/paywall", "@t402/react", "@t402/vue"].includes(p.name)) },
  { label: "WDK & Tools", packages: typescriptPackages.filter((p) => ["@t402/wdk", "@t402/wdk-gasless", "@t402/wdk-bridge", "@t402/wdk-multisig", "@t402/mcp", "@t402/cli"].includes(p.name)) },
  { label: "Advanced (Beta)", packages: advancedPackages },
];

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
      style={{ background: "rgba(255,255,255,0.1)", color: "#A1A1AA" }}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <CheckIcon style={{ color: "#50AF95" }} /> : <CopyIcon />}
    </button>
  );
}

function SDKCard({ sdk, isSelected, onSelect }: { sdk: SDK; isSelected: boolean; onSelect: () => void }) {
  const Icon = iconMap[sdk.icon];

  return (
    <motion.button
      onClick={onSelect}
      className="group relative flex w-full flex-col items-start gap-3 rounded-2xl p-4 text-left transition-all duration-300 sm:gap-4 sm:p-6"
      style={{
        background: isSelected ? "rgba(80, 175, 149, 0.08)" : "#111113",
        border: isSelected ? "1px solid rgba(80, 175, 149, 0.3)" : "1px solid rgba(255,255,255,0.08)",
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          {Icon && <Icon className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" />}
          <div className="min-w-0">
            <h3 className="text-base font-semibold sm:text-lg" style={{ color: "#FAFAFA" }}>{sdk.name}</h3>
            <p className="text-xs sm:text-sm" style={{ color: "#71717A" }}>{sdk.language}</p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-xs"
          style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
        >
          v{sdk.version}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>{sdk.description}</p>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {sdk.features.slice(0, 3).map((feature) => (
          <span
            key={feature}
            className="rounded-md px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-xs"
            style={{ background: "rgba(255,255,255,0.06)", color: "#71717A" }}
          >
            {feature}
          </span>
        ))}
        {sdk.features.length > 3 && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-xs"
            style={{ background: "rgba(255,255,255,0.06)", color: "#71717A" }}
          >
            +{sdk.features.length - 3} more
          </span>
        )}
      </div>
    </motion.button>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
        <CopyButton text={code} />
      </div>
      <pre
        className="overflow-x-auto rounded-xl p-3 pr-12 sm:p-4 sm:pr-14"
        style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <code className="text-xs leading-relaxed sm:text-sm" style={{ color: "#A1A1AA" }}>{code}</code>
      </pre>
    </div>
  );
}

function InstallCommand({ command, packageManager }: { command: string; packageManager?: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl p-2.5 sm:p-3"
      style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="hidden sm:inline" style={{ color: "#50AF95" }}>$</span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs sm:text-sm" style={{ color: "#FAFAFA" }}>{command}</code>
      <CopyButton text={command} />
    </div>
  );
}

const badgeStyles: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: "rgba(16, 185, 129, 0.1)", color: "#34D399", border: "rgba(16, 185, 129, 0.2)" },
  beta: { bg: "rgba(245, 158, 11, 0.1)", color: "#FBBF24", border: "rgba(245, 158, 11, 0.2)" },
  deprecated: { bg: "rgba(239, 68, 68, 0.1)", color: "#F87171", border: "rgba(239, 68, 68, 0.2)" },
};

function PackageCard({ pkg }: { pkg: Package }) {
  return (
    <div
      className="rounded-xl p-3 sm:p-4"
      style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
        <PackageIcon className="h-4 w-4 shrink-0" style={{ color: "#50AF95" }} />
        <code className="break-all text-xs font-medium sm:text-sm" style={{ color: "#FAFAFA" }}>{pkg.name}</code>
        {pkg.badge && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider sm:px-2 sm:text-[10px]"
            style={{
              background: badgeStyles[pkg.badge].bg,
              color: badgeStyles[pkg.badge].color,
              border: `1px solid ${badgeStyles[pkg.badge].border}`,
            }}
          >
            {pkg.badge}
          </span>
        )}
      </div>
      <p className="text-xs sm:text-sm" style={{ color: "#71717A" }}>{pkg.description}</p>
    </div>
  );
}

export default function SDKsClient() {
  const [selectedSDK, setSelectedSDK] = useState<SDK>(sdks[0]);

  return (
    <>
      {/* Hero Section - Dark */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              SDKs
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              Build with T402
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Production-ready SDKs for integrating t402 payments into your applications.
              Choose your language and start accepting payments in minutes.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SDK Selection - Light Section */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Choose Your Language
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#1A1A2E" }}>
              Official Libraries
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {sdks.map((sdk, index) => (
              <motion.div
                key={sdk.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <button
                  onClick={() => setSelectedSDK(sdk)}
                  className="card-elevated group relative flex w-full flex-col items-start gap-4 p-8 text-left"
                  style={{
                    borderColor: selectedSDK.id === sdk.id ? "#50AF95" : undefined,
                    boxShadow: selectedSDK.id === sdk.id ? "0 0 0 1px #50AF95" : undefined,
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {(() => { const Ic = iconMap[sdk.icon]; return Ic ? <Ic className="h-10 w-10 shrink-0" /> : null; })()}
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold" style={{ color: "#1A1A2E" }}>{sdk.name}</h3>
                        <p className="text-sm" style={{ color: "#718096" }}>{sdk.language}</p>
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ background: "#F7FAF9", color: "#4A5568" }}
                    >
                      v{sdk.version}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#4A5568" }}>{sdk.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {sdk.features.slice(0, 3).map((feature) => (
                      <span
                        key={feature}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ background: "#F7FAF9", color: "#718096" }}
                      >
                        {feature}
                      </span>
                    ))}
                    {sdk.features.length > 3 && (
                      <span
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ background: "#F7FAF9", color: "#718096" }}
                      >
                        +{sdk.features.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Selected SDK Details - Dark Section */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            key={selectedSDK.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid gap-12 lg:grid-cols-2"
          >
            {/* Installation & Links */}
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                  Get Started
                </span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight" style={{ color: "#FAFAFA" }}>
                  {selectedSDK.name} SDK
                </h2>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold" style={{ color: "#FAFAFA" }}>Installation</h3>
                <InstallCommand command={selectedSDK.installCommand} packageManager={selectedSDK.packageManager} />
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold" style={{ color: "#FAFAFA" }}>Quick Start</h3>
                <CodeBlock code={selectedSDK.codeExample} language={selectedSDK.language} />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href={selectedSDK.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all hover:shadow-glow"
                  style={{ background: "#50AF95", color: "#0A0A0B" }}
                >
                  View Documentation
                  <ExternalLinkIcon />
                </Link>
                <Link
                  href={selectedSDK.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#FAFAFA" }}
                >
                  <GitHubIcon className="h-4 w-4" />
                  View on GitHub
                </Link>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-6">
              <div>
                <h3 className="mb-4 text-lg font-semibold" style={{ color: "#FAFAFA" }}>Features</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {selectedSDK.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm" style={{ color: "#A1A1AA" }}>
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: "rgba(80, 175, 149, 0.15)" }}
                      >
                        <CheckIcon className="h-3 w-3" style={{ color: "#50AF95" }} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* TypeScript Packages — compact grouped list */}
              {selectedSDK.id === "typescript" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold" style={{ color: "#FAFAFA" }}>
                    Packages <span className="text-sm font-normal" style={{ color: "#71717A" }}>({typescriptPackages.length + advancedPackages.length})</span>
                  </h3>
                  {packageGroups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
                        {group.label}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.packages.map((pkg) => (
                          <div
                            key={pkg.name}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                            style={{ background: "rgba(255,255,255,0.04)" }}
                          >
                            <code className="truncate text-xs" style={{ color: "#FAFAFA" }}>{pkg.name}</code>
                            {pkg.badge && (
                              <span
                                className="shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold uppercase"
                                style={{
                                  background: badgeStyles[pkg.badge].bg,
                                  color: badgeStyles[pkg.badge].color,
                                }}
                              >
                                {pkg.badge}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Supported Chains - Light Alt Section */}
      <section className="section-light-alt py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              Multi-Chain
            </span>
            <h2 className="mt-4 mb-8 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#1A1A2E" }}>
              Supported Chains
            </h2>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3">
            {supportedChains.map((chain) => (
              <div
                key={chain.id}
                className="flex items-center gap-2 rounded-full px-4 py-2"
                style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: chain.color }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{chain.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Dark Section */}
      <section className="section-dark relative overflow-hidden py-24 md:py-32">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(80, 175, 149, 0.08), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Ready to get started?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg" style={{ color: "#A1A1AA" }}>
              Follow our quickstart guide to integrate t402 payments in under 5 minutes.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:shadow-glow"
                style={{ background: "#50AF95", color: "#0A0A0B" }}
              >
                Read the Quickstart Guide
                <ExternalLinkIcon />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
