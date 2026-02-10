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

function CheckIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
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
    <div
      className="overflow-hidden rounded-2xl"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <div
        className="h-24 w-full"
        style={{ backgroundColor: color.hex }}
      />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium" style={{ color: "#1A1A2E" }}>{color.name}</h3>
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-70"
            style={{ color: "#A1A1AA" }}
            aria-label={copied ? "Copied" : "Copy hex code"}
          >
            {copied ? (
              <CheckIcon className="h-4 w-4" style={{ color: "#50AF95" }} />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1 font-mono text-sm" style={{ color: "#4A5568" }}>
          {color.hex}
        </p>
        <p className="mt-1 font-mono text-xs" style={{ color: "#A1A1AA" }}>
          RGB: {color.rgb}
        </p>
        <p className="mt-2 text-sm" style={{ color: "#A1A1AA" }}>{color.usage}</p>
      </div>
    </div>
  );
}

function LogoPreview({
  variant,
  bgColor,
}: {
  variant: "dark" | "light";
  bgColor: string;
}) {
  return (
    <div
      className="flex h-48 items-center justify-center rounded-2xl"
      style={{ backgroundColor: bgColor, border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <span
        className="text-4xl font-bold tracking-tight"
        style={{ color: variant === "dark" ? "#0A0A0A" : "#FAFAFA" }}
      >
        T402
      </span>
    </div>
  );
}

export default function BrandClient() {
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
              Resources
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ color: "#FAFAFA" }}>
              Brand Guidelines
            </h1>
            <p className="mx-auto max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Resources and guidelines for using T402 brand assets.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Light Content */}
      <section style={{ backgroundColor: "#F7FAF9" }} className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          {/* Logo Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-20"
          >
            <h2 className="text-2xl font-bold" style={{ color: "#1A1A2E" }}>Logo</h2>
            <p className="mt-2" style={{ color: "#4A5568" }}>
              The T402 wordmark is the primary brand identifier. Use the
              appropriate version based on background color.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <LogoPreview variant="dark" bgColor="#FFFFFF" />
                <p className="mt-3 text-sm" style={{ color: "#A1A1AA" }}>
                  Dark logo on light backgrounds
                </p>
              </div>
              <div>
                <LogoPreview variant="light" bgColor="#0A0A0A" />
                <p className="mt-3 text-sm" style={{ color: "#A1A1AA" }}>
                  Light logo on dark backgrounds
                </p>
              </div>
            </div>
          </motion.div>

          {/* Color Palette */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-20"
          >
            <h2 className="text-2xl font-bold" style={{ color: "#1A1A2E" }}>Color Palette</h2>
            <p className="mt-2" style={{ color: "#4A5568" }}>
              Our brand colors reflect stability, trust, and modern technology.
              The teal green represents growth and financial prosperity.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {brandColors.map((color) => (
                <ColorCard key={color.hex} color={color} />
              ))}
            </div>
          </motion.div>

          {/* Typography */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-20"
          >
            <h2 className="text-2xl font-bold" style={{ color: "#1A1A2E" }}>Typography</h2>
            <p className="mt-2" style={{ color: "#4A5568" }}>
              T402 uses Inter as its primary typeface for its excellent legibility
              and modern aesthetic.
            </p>

            <div className="mt-8 space-y-6">
              <div
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-sm" style={{ color: "#A1A1AA" }}>Heading</p>
                <p className="mt-2 text-4xl font-bold tracking-tight" style={{ color: "#1A1A2E" }}>
                  Inter Bold - 700
                </p>
              </div>
              <div
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-sm" style={{ color: "#A1A1AA" }}>Subheading</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: "#1A1A2E" }}>
                  Inter Semibold - 600
                </p>
              </div>
              <div
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-sm" style={{ color: "#A1A1AA" }}>Body</p>
                <p className="mt-2 text-base" style={{ color: "#4A5568" }}>
                  Inter Regular - 400. Used for body text and descriptions.
                </p>
              </div>
              <div
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-sm" style={{ color: "#A1A1AA" }}>Code</p>
                <p className="mt-2 font-mono text-base" style={{ color: "#4A5568" }}>
                  JetBrains Mono - For code examples and technical content.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Usage Guidelines */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-20"
          >
            <h2 className="text-2xl font-bold" style={{ color: "#1A1A2E" }}>Usage Guidelines</h2>
            <p className="mt-2" style={{ color: "#4A5568" }}>
              Please follow these guidelines when using T402 brand assets.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <h3 className="font-semibold" style={{ color: "#50AF95" }}>Do</h3>
                <ul className="mt-4 space-y-2 text-sm" style={{ color: "#4A5568" }}>
                  <li>Use official brand colors</li>
                  <li>Maintain adequate clear space around the logo</li>
                  <li>Use high-resolution assets</li>
                  <li>Keep the logo proportions intact</li>
                  <li>Use appropriate contrast for backgrounds</li>
                </ul>
              </div>
              <div
                className="rounded-2xl p-8"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <h3 className="font-semibold" style={{ color: "#EF4444" }}>Don&apos;t</h3>
                <ul className="mt-4 space-y-2 text-sm" style={{ color: "#4A5568" }}>
                  <li>Stretch or distort the logo</li>
                  <li>Use unauthorized colors</li>
                  <li>Add effects like shadows or gradients to the logo</li>
                  <li>Use the logo on busy backgrounds</li>
                  <li>Modify or recreate the wordmark</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h2 className="text-2xl font-bold" style={{ color: "#1A1A2E" }}>Need Custom Assets?</h2>
            <p className="mt-2" style={{ color: "#4A5568" }}>
              For press inquiries or custom asset requests, please contact us.
            </p>
            <a
              href="https://github.com/t402-io/t402"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
            >
              Contact via GitHub
            </a>
          </motion.div>
        </div>
      </section>
    </>
  );
}
