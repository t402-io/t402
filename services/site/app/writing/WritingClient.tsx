"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";

interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
  authors: string[];
  image: string;
  tags: string[];
}

const articles: Article[] = [
  {
    slug: "t402-launch",
    title: "Introducing T402: The Official Payment Protocol for USDT",
    description:
      "T402 brings HTTP-native stablecoin payments to the internet. Zero fees, instant settlement, and support for 10 blockchain networks including Ethereum, TON, TRON, and Solana.",
    date: "January 15, 2026",
    authors: ["T402 Team"],
    image: "", // No image
    tags: ["Protocol", "Launch", "Announcement"],
  },
];

function ArticleCard({ article }: { article: Article }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
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
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16 text-center"
      >
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Writing
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
          Articles, announcements, and deep dives from the t402 team.
          Learn about protocol updates, technical guides, and ecosystem developments.
        </p>
      </motion.div>

      {/* Articles Grid */}
      <div className="mb-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article, index) => (
          <motion.div
            key={article.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <ArticleCard article={article} />
          </motion.div>
        ))}
      </div>

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
          Join the t402 community to get the latest updates on protocol development,
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
