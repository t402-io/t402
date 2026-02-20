"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
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
      "T402 brings HTTP-native stablecoin payments to the internet. Zero fees, instant settlement, and support for 44 networks across EVM, Solana, TON, TRON, NEAR, Aptos, and more.",
    date: "Jan 15, 2026",
    readTime: "8 min",
    tags: ["Protocol", "Launch"],
    category: "announcement",
  },
  {
    slug: "multichain-architecture",
    title: "How T402 Achieves Multi-Chain Payment Settlement",
    description:
      "A deep dive into the architecture behind T402's support for 44 networks across 10 families. Learn how CAIP-2 identifiers, scheme-network separation, and the facilitator pattern enable true multi-chain payments.",
    date: "Jan 18, 2026",
    readTime: "12 min",
    tags: ["Architecture", "Multi-Chain"],
    category: "technical",
  },
  {
    slug: "gasless-payments",
    title: "Gasless Payments with ERC-4337 Account Abstraction",
    description:
      "Users shouldn't need ETH to pay with USDT. Learn how T402 integrates ERC-4337 UserOperations and paymasters to enable gasless stablecoin transfers across EVM chains.",
    date: "Jan 20, 2026",
    readTime: "10 min",
    tags: ["ERC-4337", "Gasless"],
    category: "technical",
  },
  {
    slug: "ai-agents-mcp",
    title: "AI Agent Payments with MCP Integration",
    description:
      "How autonomous AI agents use the Model Context Protocol to discover, authorize, and execute payments without human intervention. Build AI-powered services that monetize via T402.",
    date: "Jan 22, 2026",
    readTime: "9 min",
    tags: ["AI", "MCP"],
    category: "ecosystem",
  },
  {
    slug: "getting-started-express",
    title: "Add Payments to Your Express.js API in 5 Minutes",
    description:
      "A step-by-step guide to integrating T402 payments into an existing Express.js application. From installation to accepting your first stablecoin payment.",
    date: "Jan 23, 2026",
    readTime: "5 min",
    tags: ["Tutorial", "Express.js"],
    category: "guide",
  },
  {
    slug: "sdk-comparison",
    title: "Choosing the Right T402 SDK: TypeScript, Python, Go, or Java",
    description:
      "A comprehensive guide to T402's four official SDKs. Compare features, performance characteristics, and best use cases to choose the right SDK for your project.",
    date: "Jan 25, 2026",
    readTime: "7 min",
    tags: ["SDK", "Comparison"],
    category: "guide",
  },
  {
    slug: "non-evm-chains",
    title: "Beyond EVM: Accepting Payments on TON, Solana, TRON, and More",
    description:
      "T402 isn't just for Ethereum. Learn how to accept USDT payments on TON (Telegram), Solana, TRON, NEAR, Aptos, Tezos, Polkadot, and Stacks with unified APIs.",
    date: "Jan 26, 2026",
    readTime: "11 min",
    tags: ["TON", "Solana", "TRON"],
    category: "technical",
  },
];

const categoryColors: Record<Category, string> = {
  all: "#50AF95",
  announcement: "#50AF95",
  technical: "#627EEA",
  guide: "#F59E0B",
  ecosystem: "#9945FF",
};

const categoryIcons: Record<Category, React.ReactNode> = {
  all: null,
  announcement: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  ),
  technical: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  guide: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.512.89 6.042 2.36M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.36" />
    </svg>
  ),
  ecosystem: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
};

/* ---------- Featured Card (first article, dark section) ---------- */
function FeaturedCard({ article }: { article: Article }) {
  const accent = categoryColors[article.category];

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="group"
    >
      <Link href={`/writing/${article.slug}`} className="block">
        <div className="card-elevated-dark relative overflow-hidden p-8 md:p-10">
          {/* Accent line */}
          <div
            className="absolute left-0 top-0 h-1 w-full transition-all group-hover:h-1.5"
            style={{ backgroundColor: accent }}
          />

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-12">
            {/* Icon */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              {categoryIcons[article.category]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium uppercase"
                  style={{ backgroundColor: `${accent}15`, color: accent }}
                >
                  {article.category}
                </span>
                <span className="text-sm text-foreground-tertiary">{article.date}</span>
                <span className="text-sm text-foreground-tertiary">{article.readTime} read</span>
              </div>

              <h2 className="mb-2 text-2xl font-semibold text-foreground md:text-3xl">
                {article.title}
              </h2>

              <p className="max-w-3xl text-base leading-relaxed text-foreground-secondary">
                {article.description}
              </p>
            </div>

            {/* Arrow */}
            <div className="hidden shrink-0 md:block">
              <svg
                className="h-5 w-5 text-foreground-tertiary transition-all group-hover:translate-x-1 group-hover:text-brand"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

/* ---------- Article Card (light section) ---------- */
function ArticleCard({ article, index }: { article: Article; index: number }) {
  const accent = categoryColors[article.category];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="group"
    >
      <Link href={`/writing/${article.slug}`} className="block h-full">
        <div className="card-elevated relative flex h-full flex-col overflow-hidden p-6">
          {/* Color accent line */}
          <div
            className="absolute left-0 top-0 h-1 w-full transition-all group-hover:h-1.5"
            style={{ backgroundColor: accent }}
          />

          {/* Icon + category */}
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              {categoryIcons[article.category]}
            </div>
            <div className="flex flex-col">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: accent }}
              >
                {article.category}
              </span>
              <span className="text-xs text-[var(--text-on-light-tertiary)]">{article.readTime} read</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="mb-2 text-lg font-semibold leading-snug text-[var(--text-on-light)] transition-colors group-hover:text-brand">
            {article.title}
          </h3>

          {/* Description */}
          <p className="mb-5 line-clamp-2 flex-1 text-sm leading-relaxed text-[var(--text-on-light-secondary)]">
            {article.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-4">
            <div className="flex items-center gap-3 text-xs text-[var(--text-on-light-tertiary)]">
              <span>{article.date}</span>
              <div className="flex gap-1.5">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-[var(--bg-section-light-alt)] px-1.5 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <svg
              className="h-4 w-4 text-[var(--text-on-light-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-brand"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

/* ---------- Page ---------- */
export default function WritingClient() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filteredArticles =
    activeCategory === "all"
      ? articles
      : articles.filter((a) => a.category === activeCategory);

  const featuredArticle = filteredArticles[0];
  const gridArticles = filteredArticles.slice(1);

  return (
    <>
      {/* Dark Header */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand">
              Blog
            </p>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Writing
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
              Articles, guides, and deep dives from the T402 team.
            </p>
          </motion.div>

          {/* Featured article */}
          {featuredArticle && (
            <div className="mt-12">
              <FeaturedCard article={featuredArticle} />
            </div>
          )}
        </div>
      </section>

      {/* Light Article Grid */}
      <section className="section-light py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-12 overflow-x-auto pb-2"
          >
            <div className="flex w-max min-w-full justify-start gap-2 sm:w-auto sm:justify-center">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                    style={
                      isActive
                        ? { backgroundColor: "#50AF95", color: "#0A0A0B" }
                        : { backgroundColor: "var(--bg-section-light-alt)", color: "#718096" }
                    }
                  >
                    {cat.label}
                    {cat.id !== "all" && (
                      <span className="ml-1.5 text-xs opacity-60">
                        {articles.filter((a) => a.category === cat.id).length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Articles Grid */}
          {gridArticles.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {gridArticles.map((article, i) => (
                  <ArticleCard key={article.slug} article={article} index={i} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-[var(--text-on-light-tertiary)]">No more articles in this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* Dark CTA */}
      <section className="section-dark py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="card-elevated-dark p-8 text-center sm:p-12"
          >
            <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
              Stay Updated
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
              Join the T402 community for protocol updates, new features, and ecosystem news.
            </p>
            <Link
              href="https://t.me/t402_community"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-base font-medium text-[#0A0A0B] transition-all hover:opacity-90"
            >
              Join Telegram
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
