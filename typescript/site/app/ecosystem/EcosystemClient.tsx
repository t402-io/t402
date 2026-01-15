"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import { AnimatedGrid, AnimatedCard } from "@/lib/animations";
import { EcosystemCard } from "../components/EcosystemCard";
import FacilitatorCard from "./facilitator-card";
import type { Partner, CategoryInfo } from "./data";

interface EcosystemClientProps {
  initialPartners: Partner[];
  categories: CategoryInfo[];
  initialSelectedCategory?: string | null;
}

type PartitionResult = {
  featured: Partner[];
  byCategory: Record<string, Partner[]>;
};

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function ChevronIcon({ className, isOpen }: { className?: string; isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} transition-transform ${isOpen ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function partitionPartners(partners: Partner[], categories: CategoryInfo[]): PartitionResult {
  const byCategory: Record<string, Partner[]> = { everything: [...partners] };

  // Initialize empty arrays for each category id
  for (const category of categories) {
    byCategory[category.id] = [];
  }

  // Create a map from category name to category id for lookup
  const nameToId = new Map(categories.map((c) => [c.name, c.id]));

  for (const partner of partners) {
    // Partner.category contains the display name (e.g., "Facilitators")
    // We need to map it to the category id (e.g., "facilitators")
    const categoryId = nameToId.get(partner.category);
    if (categoryId && byCategory[categoryId]) {
      byCategory[categoryId].push(partner);
    }
  }

  const featured = partners.filter((partner) => partner.featured);

  return { featured, byCategory };
}

export default function EcosystemClient({
  initialPartners,
  categories,
  initialSelectedCategory,
}: EcosystemClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isExpanded, setIsExpanded] = useState(true);

  const activeFilter =
    (searchParams.get("filter") ?? initialSelectedCategory ?? "everything") || "everything";

  const { featured, byCategory } = useMemo(
    () => partitionPartners(initialPartners, categories),
    [initialPartners, categories],
  );

  const handleFilterChange = (categoryId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId === "everything") {
      params.delete("filter");
    } else {
      params.set("filter", categoryId);
    }
    router.push(`/ecosystem${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  };

  const filteredPartners =
    activeFilter === "everything"
      ? initialPartners.filter((partner) => !partner.featured)
      : (byCategory[activeFilter] ?? []).filter((partner) => !partner.featured);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="relative mb-16">
        {/* Background gradient */}
        <div
          className="pointer-events-none absolute -top-20 right-0 h-[500px] w-[500px] opacity-30"
          style={{
            background:
              "radial-gradient(circle at center, rgba(80, 175, 149, 0.3), transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
          >
            <div className="space-y-4">
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Ecosystem
              </h1>
              <p className="max-w-md text-lg text-foreground-secondary">
                Discover innovative projects, tools, and applications built by our growing
                community of partners and developers.
              </p>
            </div>
          </motion.div>

          {featured.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-16 space-y-4"
            >
              <p className="text-sm font-medium uppercase tracking-wider text-foreground-tertiary">
                Featured projects
              </p>
              <AnimatedGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {featured.slice(0, 4).map((partner) => (
                  <AnimatedCard
                    key={partner.slug ?? partner.name}
                    layoutId={`featured-${partner.slug ?? partner.name}`}
                  >
                    {partner.facilitator ? (
                      <FacilitatorCard partner={partner} variant="featured" />
                    ) : (
                      <EcosystemCard partner={partner} variant="featured" />
                    )}
                  </AnimatedCard>
                ))}
              </AnimatedGrid>
            </motion.div>
          )}
        </div>
      </section>

      {/* Sidebar + main content */}
      <section className="flex flex-col gap-12 lg:flex-row">
        <aside className="w-full lg:w-56" aria-label="Ecosystem categories">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mb-3 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-background-secondary"
            aria-expanded={isExpanded}
          >
            <FolderIcon className="h-5 w-5 text-brand" />
            <span className="flex-1 text-sm font-medium">Ecosystem</span>
            <ChevronIcon className="h-4 w-4 text-foreground-tertiary" isOpen={isExpanded} />
          </button>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col gap-1 overflow-hidden pl-2"
              >
                {[
                  { id: "everything", name: "Everything" },
                  ...categories.map((category) => ({ id: category.id, name: category.name })),
                ].map((category) => {
                  const isActive = activeFilter === category.id;
                  const count =
                    category.id === "everything"
                      ? initialPartners.length
                      : byCategory[category.id]?.length ?? 0;

                  return (
                    <button
                      key={category.id}
                      onClick={() => handleFilterChange(category.id)}
                      className={`relative flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-background-secondary text-foreground"
                          : "text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
                      }`}
                    >
                      <span>{category.name}</span>
                      <span
                        className={`text-xs ${
                          isActive ? "text-foreground-secondary" : "text-foreground-tertiary"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </motion.nav>
            )}
          </AnimatePresence>
        </aside>

        <div className="flex-1 space-y-16">
          <AnimatePresence mode="wait">
            {activeFilter === "everything" ? (
              <motion.div
                key="everything"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-16"
              >
                {categories.map((category) => {
                  const partners = (byCategory[category.id] ?? []).filter(
                    (partner) => !partner.featured,
                  );
                  if (!partners.length) return null;

                  return (
                    <section
                      key={category.id}
                      id={category.id}
                      aria-labelledby={`${category.id}-heading`}
                      className="scroll-mt-24 space-y-4"
                    >
                      <h2
                        id={`${category.id}-heading`}
                        className="text-xl font-semibold"
                      >
                        {category.name}
                      </h2>

                      <AnimatedGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {partners.map((partner) => (
                          <AnimatedCard
                            key={partner.slug ?? partner.name}
                            layoutId={`${partner.slug ?? partner.name}-${category.id}`}
                          >
                            {partner.facilitator ? (
                              <FacilitatorCard partner={partner} />
                            ) : (
                              <EcosystemCard partner={partner} />
                            )}
                          </AnimatedCard>
                        ))}
                      </AnimatedGrid>
                    </section>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key={activeFilter}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <section className="scroll-mt-24 space-y-4">
                  <h2 className="text-xl font-semibold">
                    {categories.find((category) => category.id === activeFilter)?.name ??
                      "Ecosystem"}
                  </h2>
                  {filteredPartners.length > 0 ? (
                    <AnimatedGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredPartners.map((partner) => (
                        <AnimatedCard
                          key={partner.slug ?? partner.name}
                          layoutId={`${partner.slug ?? partner.name}-${activeFilter}`}
                        >
                          {partner.facilitator ? (
                            <FacilitatorCard partner={partner} />
                          ) : (
                            <EcosystemCard partner={partner} />
                          )}
                        </AnimatedCard>
                      ))}
                    </AnimatedGrid>
                  ) : (
                    <p className="text-sm text-foreground-tertiary">
                      No projects in this category yet.
                    </p>
                  )}
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
