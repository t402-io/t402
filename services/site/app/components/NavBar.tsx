"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { T402Logo } from "./Logo";

// Icons
function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="opacity-40"
    >
      <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" />
    </svg>
  );
}

const navLinks = [
  { href: "/sdks", label: "SDKs" },
  { href: "https://pay.t402.io", label: "Pay", external: true },
  { href: "https://docs.t402.io", label: "Docs", external: true },
];

export function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Track scroll position for enhanced header styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Check if a link is active
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-white/[0.06]"
          : "border-b border-transparent"
      }`}
      style={{ background: "rgba(10, 10, 11, 0.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-[1440px] px-6 md:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - left aligned */}
          <div className="flex shrink-0 items-center">
            <Link
              href="/"
              className="flex items-center text-foreground transition-colors duration-300 hover:text-brand"
              aria-label="T402 home"
            >
              <T402Logo title="T402" className="h-9 w-auto" />
            </Link>
          </div>

          {/* Desktop Navigation - centered */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {navLinks.map((link) => {
              const active = !link.external && isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  aria-current={active ? "page" : undefined}
                  className="group relative flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors duration-300"
                  style={{
                    color: active ? "#50AF95" : "#A1A1AA",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = "#FAFAFA";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = "#A1A1AA";
                  }}
                >
                  {link.label}
                  {link.external && <ExternalLinkIcon />}
                  {/* Active/hover underline indicator */}
                  <span
                    className={`absolute bottom-0 left-3 right-3 h-px transition-all duration-300 ${
                      active
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                    style={{ background: "#50AF95" }}
                  />
                </Link>
              );
            })}
          </div>

          {/* Desktop right side - GitHub + CTA */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="https://github.com/t402-io/t402"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-secondary transition-all duration-300 hover:text-foreground"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </Link>
            <Link
              href="https://docs.t402.io/getting-started/quickstart"
              className="inline-flex h-9 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:brightness-110"
              style={{
                background: "#50AF95",
                color: "#0A0A0B",
              }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground-secondary transition-all duration-300 hover:text-foreground lg:hidden"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile menu - slide-in drawer from right */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 top-16 z-40 lg:hidden"
              style={{ background: "rgba(0, 0, 0, 0.6)" }}
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="fixed right-0 top-16 z-50 h-[calc(100dvh-4rem)] w-full max-w-sm overflow-y-auto lg:hidden"
              style={{ background: "#0A0A0B", borderLeft: "1px solid rgba(255, 255, 255, 0.06)" }}
            >
              <div className="flex h-full flex-col px-6 py-6">
                <div className="flex-1 space-y-1">
                  {navLinks.map((link, index) => {
                    const active = !link.external && isActive(link.href);
                    return (
                      <motion.div
                        key={link.href}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.04 }}
                      >
                        <Link
                          href={link.href}
                          target={link.external ? "_blank" : undefined}
                          rel={link.external ? "noopener noreferrer" : undefined}
                          aria-current={active ? "page" : undefined}
                          className="flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-medium transition-all duration-300"
                          style={{
                            color: active ? "#50AF95" : "#A1A1AA",
                            background: active ? "rgba(80, 175, 149, 0.08)" : "transparent",
                          }}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <span className="flex items-center gap-2">
                            {link.label}
                            {link.external && <ExternalLinkIcon />}
                          </span>
                          {active && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: "#50AF95" }}
                            />
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Mobile bottom actions */}
                <div className="mt-auto space-y-3 pt-6" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <Link
                    href="https://github.com/t402-io/t402"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-all duration-300"
                    style={{ color: "#A1A1AA" }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <GitHubIcon />
                    GitHub
                  </Link>
                  <Link
                    href="https://docs.t402.io/getting-started/quickstart"
                    className="flex h-12 w-full items-center justify-center rounded-xl text-base font-medium transition-all duration-300 hover:brightness-110"
                    style={{
                      background: "#50AF95",
                      color: "#0A0A0B",
                    }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
