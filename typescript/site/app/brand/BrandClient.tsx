"use client";

import { motion } from "motion/react";
import { useState } from "react";

const brandColors = [
  {
    name: "Brand Primary",
    hex: "#50AF95",
    rgb: "80, 175, 149",
    usage: "Primary brand color, CTAs, highlights",
  },
  {
    name: "Brand Secondary",
    hex: "#3D9980",
    rgb: "61, 153, 128",
    usage: "Hover states, secondary actions",
  },
  {
    name: "Background",
    hex: "#0A0A0A",
    rgb: "10, 10, 10",
    usage: "Primary background in dark mode",
  },
  {
    name: "Background Secondary",
    hex: "#141414",
    rgb: "20, 20, 20",
    usage: "Cards, elevated surfaces",
  },
  {
    name: "Foreground",
    hex: "#FAFAFA",
    rgb: "250, 250, 250",
    usage: "Primary text color",
  },
  {
    name: "Foreground Secondary",
    hex: "#A1A1AA",
    rgb: "161, 161, 170",
    usage: "Secondary text, descriptions",
  },
];

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ColorCard({ color }: { color: (typeof brandColors)[0] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background-secondary">
      <div
        className="h-24 w-full"
        style={{ backgroundColor: color.hex }}
      />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{color.name}</h3>
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
            aria-label={copied ? "Copied" : "Copy hex code"}
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-success" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1 font-mono text-sm text-foreground-secondary">
          {color.hex}
        </p>
        <p className="mt-1 font-mono text-xs text-foreground-tertiary">
          RGB: {color.rgb}
        </p>
        <p className="mt-2 text-sm text-foreground-tertiary">{color.usage}</p>
      </div>
    </div>
  );
}

function LogoPreview({
  variant,
  bgClass,
}: {
  variant: "dark" | "light";
  bgClass: string;
}) {
  return (
    <div
      className={`flex h-48 items-center justify-center rounded-xl border border-border ${bgClass}`}
    >
      <span
        className={`text-4xl font-bold tracking-tight ${
          variant === "dark" ? "text-[#0A0A0A]" : "text-[#FAFAFA]"
        }`}
      >
        T402
      </span>
    </div>
  );
}

export default function BrandClient() {
  return (
    <div className="py-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Brand Guidelines
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground-secondary">
            Resources and guidelines for using T402 brand assets.
          </p>
        </motion.div>

        {/* Logo Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-16"
        >
          <h2 className="text-2xl font-bold">Logo</h2>
          <p className="mt-2 text-foreground-secondary">
            The T402 wordmark is the primary brand identifier. Use the
            appropriate version based on background color.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <LogoPreview variant="dark" bgClass="bg-white" />
              <p className="mt-3 text-sm text-foreground-tertiary">
                Dark logo on light backgrounds
              </p>
            </div>
            <div>
              <LogoPreview variant="light" bgClass="bg-[#0A0A0A]" />
              <p className="mt-3 text-sm text-foreground-tertiary">
                Light logo on dark backgrounds
              </p>
            </div>
          </div>
        </motion.section>

        {/* Color Palette */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-20"
        >
          <h2 className="text-2xl font-bold">Color Palette</h2>
          <p className="mt-2 text-foreground-secondary">
            Our brand colors reflect stability, trust, and modern technology.
            The teal green represents growth and financial prosperity.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {brandColors.map((color) => (
              <ColorCard key={color.hex} color={color} />
            ))}
          </div>
        </motion.section>

        {/* Typography */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-20"
        >
          <h2 className="text-2xl font-bold">Typography</h2>
          <p className="mt-2 text-foreground-secondary">
            T402 uses Inter as its primary typeface for its excellent legibility
            and modern aesthetic.
          </p>

          <div className="mt-8 space-y-6">
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-sm text-foreground-tertiary">Heading</p>
              <p className="mt-2 text-4xl font-bold tracking-tight">
                Inter Bold - 700
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-sm text-foreground-tertiary">Subheading</p>
              <p className="mt-2 text-2xl font-semibold">Inter Semibold - 600</p>
            </div>
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-sm text-foreground-tertiary">Body</p>
              <p className="mt-2 text-base">
                Inter Regular - 400. Used for body text and descriptions.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-sm text-foreground-tertiary">Code</p>
              <p className="mt-2 font-mono text-base">
                JetBrains Mono - For code examples and technical content.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Usage Guidelines */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-20"
        >
          <h2 className="text-2xl font-bold">Usage Guidelines</h2>
          <p className="mt-2 text-foreground-secondary">
            Please follow these guidelines when using T402 brand assets.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <h3 className="font-semibold text-success">Do</h3>
              <ul className="mt-4 space-y-2 text-sm text-foreground-secondary">
                <li>Use official brand colors</li>
                <li>Maintain adequate clear space around the logo</li>
                <li>Use high-resolution assets</li>
                <li>Keep the logo proportions intact</li>
                <li>Use appropriate contrast for backgrounds</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <h3 className="font-semibold text-error">Don&apos;t</h3>
              <ul className="mt-4 space-y-2 text-sm text-foreground-secondary">
                <li>Stretch or distort the logo</li>
                <li>Use unauthorized colors</li>
                <li>Add effects like shadows or gradients to the logo</li>
                <li>Use the logo on busy backgrounds</li>
                <li>Modify or recreate the wordmark</li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Contact */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-20 text-center"
        >
          <h2 className="text-2xl font-bold">Need Custom Assets?</h2>
          <p className="mt-2 text-foreground-secondary">
            For press inquiries or custom asset requests, please contact us.
          </p>
          <a
            href="https://github.com/t402-io/t402"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background-secondary px-6 text-base font-medium text-foreground transition-colors hover:bg-background-tertiary"
          >
            Contact via GitHub
          </a>
        </motion.section>
      </div>
    </div>
  );
}
