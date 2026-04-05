"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  packages,
  categoryLabels,
  partners,
  partnerCategoryLabels,
  type EcosystemCategory,
  type PartnerCategory,
} from "./data";

const categories: ("all" | EcosystemCategory)[] = [
  "all",
  "mechanisms",
  "middleware",
  "clients",
  "ui",
  "wallet",
  "agents",
  "tools",
];

const categoryDisplayLabels: Record<"all" | EcosystemCategory, string> = {
  all: "All",
  ...categoryLabels,
};

const languageColors: Record<string, string> = {
  typescript: "#3178C6",
  go: "#00ADD8",
  python: "#3776AB",
  java: "#ED8B00",
};

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

function PackageCard({ pkg }: { pkg: (typeof packages)[0] }) {
  const langColor = languageColors[pkg.language] || "#888";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="card-elevated p-6"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold"
            style={{ color: "var(--text-on-light)" }}
          >
            {pkg.name}
          </h3>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${langColor}15`,
              color: langColor,
            }}
          >
            {pkg.language}
          </span>
        </div>
        {pkg.badge && (
          <span
            className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor:
                pkg.badge === "new"
                  ? "rgba(80,175,149,0.1)"
                  : pkg.badge === "beta"
                    ? "rgba(245,158,11,0.1)"
                    : "rgba(113,113,122,0.1)",
              color:
                pkg.badge === "new"
                  ? "#50AF95"
                  : pkg.badge === "beta"
                    ? "#F59E0B"
                    : "#71717A",
            }}
          >
            {pkg.badge}
          </span>
        )}
      </div>

      <p
        className="mb-3 text-xs leading-relaxed line-clamp-2"
        style={{ color: "var(--text-on-light-secondary)" }}
      >
        {pkg.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {pkg.features.slice(0, 3).map((f) => (
          <span
            key={f}
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ backgroundColor: "var(--bg-section-light-alt)", color: "var(--text-on-light-tertiary)" }}
          >
            {f}
          </span>
        ))}
      </div>

      {pkg.npmPackage && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-light)" }}>
          <code
            className="text-xs"
            style={{ color: "var(--text-on-light-tertiary)", background: "transparent", padding: 0 }}
          >
            npm i {pkg.npmPackage}
          </code>
        </div>
      )}
    </motion.div>
  );
}

export default function EcosystemClient() {
  const [activeCategory, setActiveCategory] = useState<
    "all" | EcosystemCategory
  >("all");

  const filteredPackages =
    activeCategory === "all"
      ? packages
      : packages.filter((p) => p.category === activeCategory);

  const stats = [
    { label: "Packages", value: packages.length.toString() },
    { label: "Partners", value: partners.length.toString() },
    { label: "Languages", value: "4" },
    { label: "Blockchain Families", value: "10" },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Dark Header */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Ecosystem
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "#FAFAFA" }}>
              Built with T402
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              {packages.length}+ packages across TypeScript, Go, Python, and
              Java. From chain mechanisms to UI components.
            </p>
          </motion.div>

          {/* Stats row inside dark header */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.05 }}
                className="rounded-2xl p-5 text-center"
                style={{ backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="text-2xl font-bold" style={{ color: "#50AF95" }}>{stat.value}</div>
                <div className="mt-1 text-sm" style={{ color: "#A1A1AA" }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Light Section: Category Filter + Package Grid */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          {/* Category Filter */}
          <div className="mb-12 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300"
                style={{
                  backgroundColor: activeCategory === cat ? "#50AF95" : "var(--bg-section-light-alt)",
                  color: activeCategory === cat ? "#0A0A0B" : "var(--text-on-light-secondary)",
                }}
              >
                {categoryDisplayLabels[cat]}
                <span
                  className="ml-1.5 text-xs"
                  style={{ opacity: 0.7 }}
                >
                  {cat === "all"
                    ? packages.length
                    : packages.filter((p) => p.category === cat).length}
                </span>
              </button>
            ))}
          </div>

          {/* Package Grid */}
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredPackages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Partners Directory */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#50AF95" }}
            >
              Partners & Integrations
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Ecosystem Partners
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              {partners.length} integrations powering payments, wallets, AI agents, and infrastructure.
            </p>
          </motion.div>

          {/* Partner category groups */}
          {(Object.keys(partnerCategoryLabels) as PartnerCategory[]).map((cat) => {
            const catPartners = partners.filter((p) => p.category === cat);
            if (catPartners.length === 0) return null;
            return (
              <div key={cat} className="mb-12">
                <h3
                  className="mb-6 text-sm font-semibold uppercase tracking-widest"
                  style={{ color: "#A1A1AA" }}
                >
                  {partnerCategoryLabels[cat]}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {catPartners.map((partner) => (
                    <motion.a
                      key={partner.id}
                      href={partner.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="group rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        backgroundColor: "#111113",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold" style={{ color: "#FAFAFA" }}>
                          {partner.name}
                        </h4>
                        {partner.badge && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor:
                                partner.badge === "live"
                                  ? "rgba(80,175,149,0.15)"
                                  : partner.badge === "building"
                                    ? "rgba(245,158,11,0.15)"
                                    : "rgba(113,113,122,0.15)",
                              color:
                                partner.badge === "live"
                                  ? "#50AF95"
                                  : partner.badge === "building"
                                    ? "#F59E0B"
                                    : "#71717A",
                            }}
                          >
                            {partner.badge}
                          </span>
                        )}
                      </div>
                      <p className="mb-2 text-xs leading-relaxed line-clamp-2" style={{ color: "#A1A1AA" }}>
                        {partner.description}
                      </p>
                      <p className="text-xs" style={{ color: "#71717A" }}>
                        {partner.integration}
                      </p>
                    </motion.a>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Become a partner CTA */}
          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: "#71717A" }}>
              Building with t402?{" "}
              <a
                href="https://github.com/t402-io/t402/issues/new?template=partner.md&title=[Partner]+Your+Project+Name"
                className="underline transition-colors hover:text-white"
                style={{ color: "#50AF95" }}
              >
                Submit a PR to get listed
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Dark CTA */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "#FAFAFA" }}>
              Start Building
            </h3>
            <p className="mx-auto mb-8 max-w-xl text-lg" style={{ color: "#A1A1AA" }}>
              Install any package and start accepting payments in minutes. All
              packages work together seamlessly.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                Quickstart Guide
                <ExternalLinkIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/sdks"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all duration-300 hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#FAFAFA" }}
              >
                View SDKs
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
