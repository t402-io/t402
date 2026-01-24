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
        <div className="overflow-hidden rounded-xl border border-border bg-background-secondary transition-all hover:border-border-secondary">
          {/* Image or Placeholder */}
          <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-brand/20 to-background-tertiary">
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
                <span className="text-5xl font-bold text-brand/40">T402</span>
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
                  className="rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h2 className="mb-2 text-xl font-semibold text-foreground transition-colors group-hover:text-brand">
              {article.title}
            </h2>

            {/* Description */}
            <p className="mb-4 line-clamp-2 text-sm text-foreground-secondary">
              {article.description}
            </p>

            {/* Meta */}
            <div className="flex items-center justify-between text-sm text-foreground-tertiary">
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
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Writing
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
          Articles, announcements, and deep dives from the T402 team.
          Learn about protocol updates, technical guides, and ecosystem developments.
        </p>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-12 flex flex-wrap justify-center gap-2"
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? "bg-brand text-background"
                : "bg-background-secondary text-foreground-secondary hover:bg-background-tertiary hover:text-foreground"
            }`}
          >
            {cat.label}
            {cat.id !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                {articles.filter((a) => a.category === cat.id).length}
              </span>
            )}
          </button>
        ))}
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
          <p className="text-foreground-tertiary">No articles in this category yet.</p>
        </div>
      )}

      {/* Newsletter CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-2xl border border-border bg-background-secondary p-8 text-center sm:p-12"
      >
        <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
          Stay Updated
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
          Join the T402 community to get the latest updates on protocol development,
          new features, and ecosystem news.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="https://t.me/t402_community"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
            style={{ color: "#0A0A0B" }}
          >
            Join Telegram
            <ArrowRightIcon />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
