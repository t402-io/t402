"use client";

import Link from "next/link";
import { T402Logo } from "./Logo";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const footerLinks = {
  protocol: [
    { label: "Specification", href: "/features" },
    { label: "Whitepaper", href: "/t402-whitepaper.pdf", external: true },
    { label: "Features", href: "/features" },
    { label: "Transports", href: "/transports" },
  ],
  developers: [
    { label: "Documentation", href: "https://docs.t402.io", external: true },
    { label: "TypeScript SDK", href: "https://docs.t402.io/sdks/typescript", external: true },
    { label: "Go SDK", href: "https://docs.t402.io/sdks/go", external: true },
    { label: "Python SDK", href: "https://docs.t402.io/sdks/python", external: true },
    { label: "Java SDK", href: "https://docs.t402.io/sdks/java", external: true },
  ],
  resources: [
    { label: "GitHub", href: "https://github.com/t402-io/t402", external: true },
    { label: "Blog", href: "/writing" },
    { label: "FAQ", href: "/faq" },
    { label: "Brand Kit", href: "/brand" },
    { label: "Status", href: "/status" },
    { label: "t402 Pay", href: "https://pay.t402.io", external: true },
  ],
  chains: [
    { label: "Ethereum", href: "/chains/ethereum" },
    { label: "Solana", href: "/chains/solana" },
    { label: "TON", href: "/chains/ton" },
    { label: "TRON", href: "/chains/tron" },
    { label: "NEAR", href: "/chains/near" },
    { label: "View All Chains", href: "/chains" },
  ],
};

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase"
        style={{
          color: "#50AF95",
          letterSpacing: "0.1em",
          fontSize: "0.75rem",
        }}
        role="heading"
        aria-level={4}
      >
        {title}
      </p>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="text-sm transition-colors duration-300"
              style={{ color: "#A1A1AA" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FAFAFA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#A1A1AA"; }}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      style={{ background: "#0A0A0B" }}
      role="contentinfo"
    >
      {/* Gradient top border */}
      <div className="divider-subtle" />

      <div className="mx-auto max-w-[1440px] px-6 md:px-8 lg:px-12">
        {/* Top section: Logo + tagline + columns */}
        <div className="py-20">
          <div className="grid gap-12 lg:grid-cols-6 lg:gap-8">
            {/* Brand column */}
            <div className="lg:col-span-2">
              <Link href="/" className="inline-block text-foreground">
                <T402Logo title="T402" className="h-7 w-auto" />
              </Link>
              <p
                className="mt-4 max-w-xs text-sm leading-relaxed"
                style={{ color: "#71717A" }}
              >
                Open-source HTTP-native payment protocol for stablecoins.
                Pay with USDT, USDC, and other ERC-20 / TRC-20 / TON tokens
                across multiple blockchains.
              </p>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-8 lg:col-span-4">
              <FooterColumn title="Protocol" links={footerLinks.protocol} />
              <FooterColumn title="Developers" links={footerLinks.developers} />
              <FooterColumn title="Resources" links={footerLinks.resources} />
              <FooterColumn title="Chains" links={footerLinks.chains} />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        {/* Trademark disclaimer moved to layout.tsx as a SSR aside —
            see services/site/app/layout.tsx for the source-of-truth text. */}
        <div
          className="flex flex-col items-center justify-between gap-6 py-6 sm:flex-row"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
        >
          {/* Copyright - left */}
          <p className="text-sm" style={{ color: "#52525B" }}>
            &copy; {new Date().getFullYear()} T402 Protocol. Apache 2.0 License.
          </p>

          {/* Social icons - center */}
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/t402-io/t402"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300"
              style={{ color: "#52525B" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#50AF95"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#52525B"; }}
              aria-label="GitHub"
            >
              <GitHubIcon className="h-5 w-5" />
            </Link>
            <Link
              href="https://t.me/t402_io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300"
              style={{ color: "#52525B" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#50AF95"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#52525B"; }}
              aria-label="Telegram"
            >
              <TelegramIcon className="h-5 w-5" />
            </Link>
          </div>

          {/* Legal links - right */}
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm transition-colors duration-300"
              style={{ color: "#52525B" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#A1A1AA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#52525B"; }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm transition-colors duration-300"
              style={{ color: "#52525B" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#A1A1AA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#52525B"; }}
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
