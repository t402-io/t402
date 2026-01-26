"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  packages,
  categoryLabels,
  type EcosystemCategory,
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
      className="group relative rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {pkg.name}
          </h3>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${langColor}20`,
              color: langColor,
            }}
          >
            {pkg.language}
          </span>
        </div>
        {pkg.badge && (
          <span
            className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              pkg.badge === "new"
                ? "bg-emerald-500/20 text-emerald-400"
                : pkg.badge === "beta"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-gray-500/20 text-gray-400"
            }`}
          >
            {pkg.badge}
          </span>
        )}
      </div>

      <p className="mb-3 text-xs text-gray-400 line-clamp-2">
        {pkg.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {pkg.features.slice(0, 3).map((f) => (
          <span
            key={f}
            className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-500"
          >
            {f}
          </span>
        ))}
      </div>

      {pkg.npmPackage && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <code className="text-xs text-gray-500">
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
    { label: "Languages", value: "4" },
    { label: "Categories", value: Object.keys(categoryLabels).length.toString() },
    { label: "Blockchain Families", value: "10" },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Header */}
      <section className="relative px-6 pt-32 pb-16 md:px-12">
        <div className="mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              Ecosystem
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              {packages.length}+ packages across TypeScript, Go, Python, and
              Java. From chain mechanisms to UI components.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-12 md:px-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center"
            >
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Category Filter */}
      <section className="px-6 pb-8 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {categoryDisplayLabels[cat]}
                <span className="ml-1.5 text-xs text-gray-500">
                  {cat === "all"
                    ? packages.length
                    : packages.filter((p) => p.category === cat).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Package Grid */}
      <section className="px-6 pb-16 md:px-12">
        <div className="mx-auto max-w-6xl">
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredPackages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-12"
          >
            <h3 className="mb-3 text-2xl font-bold text-white">
              Start Building
            </h3>
            <p className="mb-6 text-gray-400">
              Install any package and start accepting payments in minutes. All
              packages work together seamlessly.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="https://docs.t402.io/getting-started/quickstart"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Quickstart Guide
                <ExternalLinkIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/sdks"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
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
