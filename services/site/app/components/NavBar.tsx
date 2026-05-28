"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T402Logo } from "./Logo";

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const navLinks = [
  { href: "/sdks", label: "SDKs" },
  { href: "https://pay.t402.io", label: "Pay", external: true },
  { href: "https://docs.t402.io", label: "Docs", external: true },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-[var(--color-rule-soft)]"
      style={{
        background: "rgba(250, 250, 247, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-[1440px] px-4 md:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center text-[var(--color-foreground)] transition-colors hover:text-[var(--color-brand)]"
            aria-label="T402 home"
          >
            <T402Logo title="T402" className="h-9 w-auto" />
          </Link>

          {/* Inline nav (no drawer; 3 links fit on every viewport) */}
          <div className="flex items-center gap-1 sm:gap-3">
            {navLinks.map((link) => {
              const active = !link.external && pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  aria-current={active ? "page" : undefined}
                  className="font-serif text-base italic transition-colors hover:text-[var(--color-brand)]"
                  style={{
                    color: active
                      ? "var(--color-brand)"
                      : "var(--color-foreground-secondary)",
                    padding: "0.5rem 0.5rem",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="https://github.com/t402-io/t402"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 flex h-9 w-9 items-center justify-center text-[var(--color-foreground-secondary)] transition-colors hover:text-[var(--color-foreground)]"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
