import Link from "next/link";

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
  product: [
    { label: "SDKs", href: "/sdks" },
    { label: "Chains", href: "/chains" },
    { label: "Features", href: "/features" },
    { label: "Playground", href: "/playground" },
    { label: "Compare", href: "/compare" },
  ],
  developers: [
    { label: "Documentation", href: "https://docs.t402.io" },
    { label: "TypeScript SDK", href: "https://docs.t402.io/sdks/typescript" },
    { label: "Python SDK", href: "https://docs.t402.io/sdks/python" },
    { label: "Go SDK", href: "https://docs.t402.io/sdks/go" },
    { label: "Java SDK", href: "https://docs.t402.io/sdks/java" },
  ],
  resources: [
    {
      label: "GitHub",
      href: "https://github.com/t402-io/t402",
      external: true,
    },
    {
      label: "Whitepaper",
      href: "/t402-whitepaper.pdf",
      external: true,
    },
    { label: "Blog", href: "/writing" },
    { label: "Brand", href: "/brand" },
  ],
  chains: [
    { label: "Ethereum", href: "https://docs.t402.io/chains/ethereum" },
    { label: "Base", href: "https://docs.t402.io/chains/base" },
    { label: "Arbitrum", href: "https://docs.t402.io/chains/arbitrum" },
    { label: "TON", href: "https://docs.t402.io/chains/ton" },
    { label: "TRON", href: "https://docs.t402.io/chains/tron" },
    { label: "Solana", href: "https://docs.t402.io/chains/solana" },
  ],
};

export function Footer() {
  return (
    <footer
      className="border-t border-border bg-background"
      role="contentinfo"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid gap-12 lg:grid-cols-6">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                T402
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-foreground-secondary">
              The official payment protocol for USDT. HTTP-native stablecoin
              payments across multiple blockchains.
            </p>

            {/* Social Links */}
            <div className="mt-6 flex items-center gap-4">
              <Link
                href="https://github.com/t402-io/t402"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
                aria-label="GitHub"
              >
                <GitHubIcon className="h-5 w-5" />
              </Link>
              <Link
                href="https://t.me/t402_io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
                aria-label="Telegram"
              >
                <TelegramIcon className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Links Columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-4">
            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Product</h3>
              <ul className="mt-4 space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Developers */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Developers
              </h3>
              <ul className="mt-4 space-y-3">
                {footerLinks.developers.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Resources
              </h3>
              <ul className="mt-4 space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chains */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Chains</h3>
              <ul className="mt-4 space-y-3">
                {footerLinks.chains.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-foreground-tertiary">
            {new Date().getFullYear()} T402. The official payment protocol for
            USDT.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm text-foreground-tertiary transition-colors hover:text-foreground-secondary"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-foreground-tertiary transition-colors hover:text-foreground-secondary"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
