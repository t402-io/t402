import Image from "next/image";
import Link from "next/link";

import type { Partner } from "../ecosystem/data";

interface EcosystemCardProps {
  partner: Partner;
  variant?: "featured" | "standard";
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

export function EcosystemCard({ partner, variant = "standard" }: EcosystemCardProps) {
  const isExternal = partner.websiteUrl.startsWith("http");
  const isFeatured = variant === "featured";
  const tagLabel = partner.typeLabel ?? partner.category;

  return (
    <article
      className={`group relative flex h-full w-full flex-col rounded-xl border border-border bg-background-secondary transition-all duration-200 hover:border-brand hover:bg-background-tertiary ${
        isFeatured ? "p-4" : "p-5"
      }`}
    >
      <Link
        href={partner.websiteUrl}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="absolute inset-0 z-20 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Learn more about ${partner.name}`}
      />

      <div
        className={`pointer-events-none relative z-10 flex items-start justify-between ${
          isFeatured ? "mb-3" : "mb-4"
        }`}
      >
        {partner.logoUrl ? (
          <div
            className={`overflow-hidden rounded-lg bg-background-tertiary ${
              isFeatured ? "h-12 w-12" : "h-14 w-14"
            }`}
          >
            <Image
              src={partner.logoUrl}
              alt={`${partner.name} logo`}
              width={120}
              height={120}
              className="h-full w-full object-contain p-2"
            />
          </div>
        ) : (
          <div
            className={`rounded-lg bg-background-tertiary ${
              isFeatured ? "h-12 w-12" : "h-14 w-14"
            }`}
            aria-hidden="true"
          />
        )}

        <span className="rounded-full bg-background-tertiary px-2.5 py-1 text-xs font-medium text-foreground-secondary">
          {tagLabel}
        </span>
      </div>

      <div className="pointer-events-none relative z-10 flex-1 space-y-2">
        <h3
          className={`font-semibold leading-snug ${
            isFeatured ? "text-sm" : "text-base"
          }`}
        >
          {partner.name}
        </h3>
        <p
          className={`leading-relaxed text-foreground-secondary ${
            isFeatured ? "text-xs" : "text-sm"
          }`}
        >
          {partner.description}
        </p>
      </div>

      <div
        className={`pointer-events-none relative z-10 ${
          isFeatured ? "mt-3" : "mt-4"
        }`}
      >
        <span
          className={`inline-flex items-center gap-1.5 font-medium text-brand transition-colors group-hover:text-brand-secondary ${
            isFeatured ? "text-xs" : "text-sm"
          }`}
        >
          Visit website
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
