"use client";

import { useState, type KeyboardEvent } from "react";
import Image from "next/image";
import type { Partner } from "./data";

interface FacilitatorCardProps {
  partner: Partner;
  variant?: "standard" | "featured";
}

function CloseIcon({ className }: { className?: string }) {
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
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export default function FacilitatorCard({
  partner,
  variant = "standard",
}: FacilitatorCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!partner.facilitator) {
    return null;
  }

  const { facilitator } = partner;
  const isFeatured = variant === "featured";
  const tagLabel = partner.typeLabel ?? partner.category;
  const handleOpen = () => setIsModalOpen(true);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        className={`group relative flex h-full w-full cursor-pointer flex-col rounded-xl border border-border bg-background-secondary outline-none transition-all duration-200 hover:border-brand hover:bg-background-tertiary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isFeatured ? "p-4" : "p-5"
        }`}
      >
        <div
          className={`relative z-20 flex items-start justify-between ${
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

        <div className="relative z-20 flex-1 space-y-2">
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
          className={`relative z-20 ${isFeatured ? "mt-3" : "mt-4"}`}
        >
          <span
            className={`inline-flex items-center gap-1.5 font-medium text-brand transition-colors group-hover:text-brand-secondary ${
              isFeatured ? "text-xs" : "text-sm"
            }`}
          >
            View details
            <ArrowIcon className="h-3.5 w-3.5" />
          </span>
        </div>
      </article>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-overlay-backdrop backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background-secondary shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-6">
              <div className="flex items-center gap-4">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-background-tertiary">
                  <Image
                    src={partner.logoUrl}
                    alt={`${partner.name} logo`}
                    fill
                    sizes="48px"
                    className="object-contain p-2"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{partner.name}</h2>
                  <p className="text-sm text-foreground-tertiary">Facilitator</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                aria-label="Close modal"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-6 p-6">
              {/* Description */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground-tertiary">
                  Description
                </h3>
                <p className="text-foreground-secondary">{partner.description}</p>
              </div>

              {/* Base URL */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground-tertiary">
                  Base URL
                </h3>
                <a
                  href={facilitator.baseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-sm text-brand hover:text-brand-secondary"
                >
                  {facilitator.baseUrl}
                </a>
              </div>

              {/* Networks */}
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-tertiary">
                  Supported Networks
                </h3>
                <div className="flex flex-wrap gap-2">
                  {facilitator.networks.map((network) => (
                    <span
                      key={network}
                      className="rounded-full bg-background-tertiary px-3 py-1 text-sm text-foreground-secondary"
                    >
                      {network}
                    </span>
                  ))}
                </div>
              </div>

              {/* Schemes */}
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-tertiary">
                  Payment Schemes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {facilitator.schemes.map((scheme) => (
                    <span
                      key={scheme}
                      className="rounded-full bg-brand-muted px-3 py-1 text-sm text-brand"
                    >
                      {scheme}
                    </span>
                  ))}
                </div>
              </div>

              {/* Assets */}
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-tertiary">
                  Supported Assets
                </h3>
                <div className="flex flex-wrap gap-2">
                  {facilitator.assets.map((asset) => (
                    <span
                      key={asset}
                      className="rounded-full bg-chain-ethereum/10 px-3 py-1 text-sm text-chain-ethereum"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-tertiary">
                  Capabilities
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        facilitator.supports.verify
                          ? "bg-success/20 text-success"
                          : "bg-error/20 text-error"
                      }`}
                    >
                      {facilitator.supports.verify ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        <XIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span className="text-sm text-foreground-secondary">
                      Verify Payments
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        facilitator.supports.settle
                          ? "bg-success/20 text-success"
                          : "bg-error/20 text-error"
                      }`}
                    >
                      {facilitator.supports.settle ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        <XIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span className="text-sm text-foreground-secondary">
                      Settle Payments
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        facilitator.supports.supported
                          ? "bg-success/20 text-success"
                          : "bg-error/20 text-error"
                      }`}
                    >
                      {facilitator.supports.supported ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        <XIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span className="text-sm text-foreground-secondary">
                      Supported Endpoint
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        facilitator.supports.list
                          ? "bg-success/20 text-success"
                          : "bg-error/20 text-error"
                      }`}
                    >
                      {facilitator.supports.list ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        <XIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span className="text-sm text-foreground-secondary">
                      List Resources
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-border p-6">
              <a
                href={partner.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-6 text-sm font-medium text-background transition-colors hover:bg-brand-secondary"
              >
                Visit Website
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
