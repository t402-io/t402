"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";

interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
  authors: string[];
  image: string;
  tags: string[];
  category: Category;
}

type Category = "all" | "announcement" | "technical" | "ecosystem" | "guide";

const categories: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "announcement", label: "Announcements" },
  { id: "technical", label: "Technical" },
  { id: "guide", label: "Guides" },
  { id: "ecosystem", label: "Ecosystem" },
];

const articles: Article[] = [
  {
    slug: "t402-launch",
    title: "Introducing T402: The Official Payment Protocol for USDT",
    description:
      "T402 brings HTTP-native stablecoin payments to the internet. Zero fees, instant settlement, and support for 28 blockchains across EVM, Solana, TON, TRON, NEAR, Aptos, and more.",
    date: "January 15, 2026",
    authors: ["T402 Team"],
    image: "",
    tags: ["Protocol", "Launch", "Announcement"],
    category: "announcement",
  },
  {
    slug: "multichain-architecture",
    title: "How T402 Achieves Multi-Chain Payment Settlement",
    description:
      "A deep dive into the architecture behind T402's support for 28 blockchains across 10 families. Learn how CAIP-2 identifiers, scheme-network separation, and the facilitator pattern enable true multi-chain payments.",
    date: "January 18, 2026",
    authors: ["T402 Team"],
    image: "",
    tags: ["Architecture", "Multi-Chain", "Deep Dive"],
    category: "technical",
  },
  {
    slug: "gasless-payments",
    title: "Gasless Payments with ERC-4337 Account Abstraction",
    description:
      "Users shouldn't need ETH to pay with USDT. Learn how T402 integrates ERC-4337 UserOperations and paymasters to enable gasless stablecoin transfers across EVM chains.",
    date: "January 20, 2026",
    authors: ["T402 Team"],
    image: "",
    tags: ["ERC-4337", "Gasless", "Account Abstraction"],
    category: "technical",
  },
  {
    slug: "ai-agents-mcp",
    title: "AI Agent Payments with MCP Integration",
    description:
      "How autonomous AI agents use the Model Context Protocol to discover, authorize, and execute payments without human intervention. Build AI-powered services that monetize via T402.",
    date: "January 22, 2026",
    authors: ["T402 Team"],
    image: "",
    tags: ["AI", "MCP", "Agents"],
    category: "ecosystem",
  },
  {
    slug: "getting-started-express",
    title: "Add Payments to Your Express.js API in 5 Minutes",
    description:
      "A step-by-step guide to integrating T402 payments into an existing Express.js application. From installation to accepting your first stablecoin payment.",
    date: "January 23, 2026",
    authors: ["T402 Team"],
    image: "",
    tags: ["Tutorial", "Express.js", "TypeScript"],
    category: "guide",
  },
  {
    slug: "sdk-comparison",
    title: "Choosing the Right T402 SDK: TypeScript, Python, Go, or Java",
    description:
      "A comprehensive guide to T402's four official SDKs. Compare features, performance characteristics, and best use cases to choose the right SDK for your project.",
    date: "January 25, 2026",
    authors: ["T402 Team"],
    image: "",
    tags: ["SDK", "TypeScript", "Python", "Go", "Java"],
    category: "guide",
  },
  {
    slug: "non-evm-chains",
    title: "Beyond EVM: Accepting Payments on TON, Solana, TRON, and More",
    description:
      "T402 isn't just for Ethereum. Learn how to accept USDT payments on TON (Telegram), Solana, TRON, NEAR, Aptos, Tezos, Polkadot, and Stacks with unified APIs.",
    date: "January 26, 2026",
    authors: ["T402 Team"],
    image: "",
    tags: ["TON", "Solana", "TRON", "Multi-Chain"],
    category: "technical",
  },
];

function ArticleCard({ article }: { article: Article }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <Link href={`/writing/${article.slug}`} className="block">
        <div
          className="overflow-hidden rounded-2xl transition-all"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Image or Placeholder */}
          <div className="relative aspect-video overflow-hidden" style={{ backgroundColor: "#F7FAF9" }}>
            {article.image ? (
              <Image
                src={article.image}
                alt={article.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-bold" style={{ color: "rgba(80,175,149,0.3)" }}>T402</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Tags */}
            <div className="mb-3 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md px-2 py-1 text-xs font-medium"
                  style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h2
              className="mb-2 text-xl font-semibold transition-colors group-hover:opacity-80"
              style={{ color: "#1A1A2E" }}
            >
              {article.title}
            </h2>

            {/* Description */}
            <p className="mb-4 line-clamp-2 text-sm" style={{ color: "#4A5568" }}>
              {article.description}
            </p>

            {/* Meta */}
            <div className="flex items-center justify-between text-sm" style={{ color: "#A1A1AA" }}>
              <span>{article.date}</span>
              <span>{article.authors.join(", ")}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function WritingClient() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filteredArticles =
    activeCategory === "all"
      ? articles
      : articles.filter((a) => a.category === activeCategory);

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
              Blog
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ color: "#FAFAFA" }}>
              Writing
            </h1>
            <p className="mx-auto max-w-2xl text-lg" style={{ color: "#A1A1AA" }}>
              Articles, announcements, and deep dives from the T402 team.
              Learn about protocol updates, technical guides, and ecosystem developments.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Light Article Grid */}
      <section style={{ backgroundColor: "#F7FAF9" }} className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-12 overflow-x-auto pb-2"
          >
            <div className="flex w-max min-w-full justify-start gap-2 sm:w-auto sm:justify-center">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                  style={
                    activeCategory === cat.id
                      ? { backgroundColor: "#50AF95", color: "#0A0A0B" }
                      : { backgroundColor: "#FFFFFF", color: "#4A5568", border: "1px solid rgba(0,0,0,0.08)" }
                  }
                >
                  {cat.label}
                  {cat.id !== "all" && (
                    <span className="ml-1.5 text-xs opacity-70">
                      {articles.filter((a) => a.category === cat.id).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Articles Grid */}
          <div className="mb-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </AnimatePresence>
          </div>

          {filteredArticles.length === 0 && (
            <div className="mb-20 text-center py-12">
              <p style={{ color: "#A1A1AA" }}>No articles in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-2xl p-8 sm:p-12 text-center"
            style={{ backgroundColor: "#F7FAF9", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
              Stay Updated
            </h2>
            <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
              Join the T402 community to get the latest updates on protocol development,
              new features, and ecosystem news.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="https://t.me/t402_community"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
              >
                Join Telegram
                <ArrowRightIcon />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
