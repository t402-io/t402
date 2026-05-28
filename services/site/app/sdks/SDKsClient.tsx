"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { sdks, type SDK } from "./data";

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

function JavaIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M11.61 19.36s-1.04.6.74.81c2.16.25 3.26.21 5.65-.24a9.55 9.55 0 0 0 1.5.74c-5.34 2.3-12.08-.13-7.89-1.31zM10.96 16.43s-1.16.86.62 1.05c2.3.25 4.12.27 7.29-.34a3.17 3.17 0 0 0 1.12.69c-6.45 1.89-13.65.15-9.03-1.4z"
        fill="#0074BD"
      />
      <path
        d="M16.47 11.27c1.3 1.51-.34 2.86-.34 2.86s3.31-1.71 1.79-3.85c-1.42-2-2.51-3 3.39-6.43 0 0-9.25 2.31-4.84 7.42z"
        fill="#EA2D2E"
      />
      <path
        d="M23.49 21.55s.77.63-.85 1.12c-3.07.93-12.79 1.21-15.49.04-.97-.42.85-1 1.43-1.12.6-.13.94-.11.94-.11-1.08-.76-6.99 1.49-3 2.13 10.86 1.76 19.81-.79 16.97-2.06zM12.1 13.4s-4.95 1.18-1.76 1.6c1.35.18 4.04.14 6.54-.07 2.05-.17 4.1-.54 4.1-.54s-.72.31-1.24.66c-5.03 1.32-14.74.7-11.94-.65 2.37-1.14 4.3-1 4.3-1zM21.18 18.47c5.11-2.65 2.75-5.2 1.1-4.86-.4.08-.58.15-.58.15s.15-.24.45-.34c3.36-1.18 5.94 3.49-1.05 5.18 0 0 .06-.05.08-.13zM18.9 0s2.83 2.83-2.68 7.18c-4.42 3.49-1.01 5.48 0 7.75-2.58-2.33-4.48-4.38-3.2-6.29C14.89 5.85 20.04 4.5 18.9 0z"
        fill="#0074BD"
      />
      <path
        d="M12.6 25.61c4.91.31 12.44-.17 12.62-2.49 0 0-.34.88-4.05 1.58-4.18.79-9.34.7-12.41.19 0 0 .62.51 3.84.72z"
        fill="#EA2D2E"
      />
    </svg>
  );
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  typescript: TypeScriptIcon,
  python: PythonIcon,
  go: GoIcon,
  java: JavaIcon,
};

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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
      style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
      aria-label={copied ? "Copied" : "Copy install command"}
    >
      {copied ? <CheckIcon style={{ color: "#50AF95" }} /> : <CopyIcon />}
    </button>
  );
}

function SDKCard({ sdk, index }: { sdk: SDK; index: number }) {
  const Icon = iconMap[sdk.icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="rounded-2xl p-6 sm:p-8"
      style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-10 w-10 shrink-0" />}
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "#FAFAFA" }}>
              {sdk.name}
            </h3>
            <p className="text-sm" style={{ color: "#71717A" }}>
              {sdk.language}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
        >
          v{sdk.version}
        </span>
      </div>

      <p className="mb-6 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
        {sdk.description}
      </p>

      <div
        className="mb-6 flex items-center gap-2 rounded-xl p-3"
        style={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span style={{ color: "#50AF95" }}>$</span>
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm" style={{ color: "#FAFAFA" }}>
          {sdk.installCommand}
        </code>
        <CopyButton text={sdk.installCommand} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={sdk.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "#50AF95", color: "#0A0A0B" }}
        >
          Docs
          <ExternalLinkIcon />
        </Link>
        <Link
          href={sdk.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all"
          style={{ border: "1px solid rgba(255,255,255,0.16)", color: "#FAFAFA" }}
        >
          <GitHubIcon className="h-4 w-4" />
          GitHub
        </Link>
      </div>
    </motion.div>
  );
}

export default function SDKsClient() {
  return (
    <>
      {/* Hero */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#50AF95" }}>
              SDKs
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              Build with T402
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Official SDKs for TypeScript, Python, Go, and Java. Pick a language, copy the
              install command, and follow the docs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SDK grid */}
      <section className="section-dark pb-24 md:pb-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {sdks.map((sdk, index) => (
              <SDKCard key={sdk.id} sdk={sdk} index={index} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 text-center"
          >
            <Link
              href="https://docs.t402.io/getting-started/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold transition-all hover:shadow-glow"
              style={{ background: "#50AF95", color: "#0A0A0B" }}
            >
              Read the Quickstart
              <ExternalLinkIcon />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
