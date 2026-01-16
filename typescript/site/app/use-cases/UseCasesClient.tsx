"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  useCases,
  categories,
  getUseCasesByCategory,
  type UseCase,
  type UseCaseCategory,
} from "./data";

// Icons
type IconProps = { className?: string; style?: React.CSSProperties };

function ApiIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="8" cy="6" r="1" fill="currentColor" />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="8" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function ChartIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function ArticleIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function VideoIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function DownloadIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function BrainIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54" />
    </svg>
  );
}

function RobotIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function NetworkIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
      <line x1="12" y1="8" x2="5" y2="16" />
      <line x1="12" y1="8" x2="19" y2="16" />
    </svg>
  );
}

function CartIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function RepeatIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function GlobeIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CloudIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function ServerIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function CodeIcon({ className = "", style }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function ArrowRightIcon({ className = "", style }: IconProps) {
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
      style={style}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const iconMap: Record<string, React.FC<IconProps>> = {
  api: ApiIcon,
  chart: ChartIcon,
  article: ArticleIcon,
  video: VideoIcon,
  download: DownloadIcon,
  brain: BrainIcon,
  robot: RobotIcon,
  network: NetworkIcon,
  cart: CartIcon,
  repeat: RepeatIcon,
  globe: GlobeIcon,
  cloud: CloudIcon,
  server: ServerIcon,
  code: CodeIcon,
};

function CategoryTab({
  category,
  isSelected,
  onClick,
  count,
}: {
  category: { id: UseCaseCategory | "all"; name: string };
  isSelected: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        isSelected
          ? "text-foreground"
          : "text-foreground-tertiary hover:text-foreground-secondary"
      }`}
      aria-pressed={isSelected}
    >
      {isSelected && (
        <motion.div
          layoutId="activeCategory"
          className="absolute inset-0 rounded-lg bg-background-tertiary"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-10">{category.name}</span>
      <span className="relative z-10 rounded-full bg-background-elevated px-2 py-0.5 text-xs">
        {count}
      </span>
    </button>
  );
}

function UseCaseCard({ useCase, index }: { useCase: UseCase; index: number }) {
  const Icon = iconMap[useCase.icon] || ApiIcon;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-background-secondary transition-all hover:border-border-secondary"
    >
      {/* Color accent */}
      <div
        className="absolute left-0 top-0 h-1 w-full"
        style={{ backgroundColor: useCase.color }}
      />

      <div className="p-6">
        {/* Header */}
        <div className="mb-4 flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${useCase.color}20` }}
          >
            <Icon className="h-6 w-6" style={{ color: useCase.color }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{useCase.title}</h3>
            <p className="text-sm text-foreground-tertiary">
              {categories.find((c) => c.id === useCase.category)?.name}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm leading-relaxed text-foreground-secondary">
          {useCase.description}
        </p>

        {/* Benefits */}
        <div className="mb-4 flex flex-wrap gap-2">
          {useCase.benefits.slice(0, 3).map((benefit) => (
            <span
              key={benefit}
              className="flex items-center gap-1 rounded-md bg-background-tertiary px-2 py-1 text-xs text-foreground-tertiary"
            >
              <CheckIcon className="h-3 w-3 text-brand" />
              {benefit}
            </span>
          ))}
        </div>

        {/* Example */}
        <div
          className="mb-4 rounded-lg p-4"
          style={{ backgroundColor: `${useCase.color}10` }}
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground-tertiary">
            Example
          </p>
          <p className="text-sm font-medium text-foreground">{useCase.example.title}</p>
          <p className="text-sm text-foreground-secondary">{useCase.example.description}</p>
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-brand"
          style={{ color: useCase.color }}
        >
          {isExpanded ? "Show less" : "Learn more"}
          <ArrowRightIcon
            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
            style={{ color: useCase.color }}
          />
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-4 text-sm text-foreground-secondary">
                  {useCase.longDescription}
                </p>

                {/* Industries */}
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-tertiary">
                    Industries
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {useCase.industries.map((industry) => (
                      <span
                        key={industry}
                        className="rounded-full bg-background-tertiary px-3 py-1 text-xs text-foreground-secondary"
                      >
                        {industry}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Features */}
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-tertiary">
                    Features
                  </p>
                  <ul className="grid grid-cols-2 gap-2">
                    {useCase.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-foreground-secondary"
                      >
                        <CheckIcon className="h-3 w-3 shrink-0 text-brand" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Code snippet */}
                {useCase.codeSnippet && (
                  <div className="overflow-hidden rounded-lg border border-border bg-background-tertiary">
                    <div className="border-b border-border bg-background-secondary px-4 py-2">
                      <span className="text-xs font-medium text-foreground-tertiary">
                        Implementation
                      </span>
                    </div>
                    <pre className="overflow-x-auto p-4">
                      <code className="text-xs text-foreground-secondary">
                        {useCase.codeSnippet}
                      </code>
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function UseCasesClient() {
  const [selectedCategory, setSelectedCategory] = useState<UseCaseCategory | "all">("all");

  const filteredUseCases =
    selectedCategory === "all" ? useCases : getUseCasesByCategory(selectedCategory);

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
          Use Cases
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-foreground-secondary">
          Discover how t402 enables new payment models across industries. From API monetization
          to AI agent payments, see what's possible with HTTP-native stablecoin payments.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{useCases.length}</p>
          <p className="text-sm text-foreground-tertiary">Use Cases</p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{categories.length}</p>
          <p className="text-sm text-foreground-tertiary">Categories</p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">10+</p>
          <p className="text-sm text-foreground-tertiary">Chains Supported</p>
        </div>
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-center">
          <p className="text-3xl font-bold text-foreground">$0.001</p>
          <p className="text-sm text-foreground-tertiary">Min Payment</p>
        </div>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mb-8 flex flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-background-secondary p-1.5"
      >
        <CategoryTab
          category={{ id: "all", name: "All" }}
          isSelected={selectedCategory === "all"}
          onClick={() => setSelectedCategory("all")}
          count={useCases.length}
        />
        {categories.map((category) => (
          <CategoryTab
            key={category.id}
            category={category}
            isSelected={selectedCategory === category.id}
            onClick={() => setSelectedCategory(category.id)}
            count={getUseCasesByCategory(category.id).length}
          />
        ))}
      </motion.div>

      {/* Use Cases Grid */}
      <motion.div layout className="mb-20 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredUseCases.map((useCase, index) => (
            <UseCaseCard key={useCase.id} useCase={useCase} index={index} />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-2xl border border-border bg-background-secondary p-8 text-center sm:p-12"
      >
        <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
          Build your use case
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
          Have a unique payment model in mind? Our SDKs make it easy to implement any of these
          use cases and more. Get started in minutes.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/sdks"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
            style={{ color: "#0A0A0B" }}
          >
            View SDKs
          </Link>
          <Link
            href="https://docs.t402.io/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
          >
            Quickstart Guide
            <ExternalLinkIcon />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
