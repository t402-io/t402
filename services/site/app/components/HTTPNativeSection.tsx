"use client";

import Image from "next/image";
import React from "react";

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-[64px] w-[64px] items-center justify-center border border-[var(--color-foreground)] bg-[var(--color-background)] text-[var(--color-foreground)]"
      style={{ borderRadius: 0 }}
    >
      {children}
    </div>
  );
}

function AgentIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6.7721 5.71294L2.92237 9.56267V10.4175L6.7721 14.2672L5.7642 15.2751L1.49695 11.0079V8.97226L5.7642 4.70505L6.7721 5.71294Z" fill="currentColor" />
      <path d="M13.2279 14.2871L17.0776 10.4373L17.0776 9.58248L13.2279 5.73276L14.2358 4.72486L18.5031 8.99207L18.5031 11.0277L14.2358 15.295L13.2279 14.2871Z" fill="currentColor" />
      <rect x="7.35699" y="9.29807" width="1.42542" height="1.42542" fill="currentColor" />
      <rect x="11.1978" y="9.29807" width="1.42542" height="1.42542" fill="currentColor" />
    </svg>
  );
}

function TransactionIcon() {
  return (
    <Image
      src="/images/icons/transaction.svg"
      alt=""
      width={28}
      height={28}
      aria-hidden="true"
    />
  );
}

function PunkIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M18.5029 8.99219V11.0273L14.2354 15.2949L13.2275 14.2871L13.7461 13.7686H10.5254V12.2969H15.2178L17.0771 10.4375V9.58203L16.5889 9.09375H15.251V10.9531H13.3252V9.09375H12.4512V10.9531H10.5254V9.09375H8.27051L6.8252 10.5381L5.78418 9.49707L7.63281 7.64844V7.62109H15.1162L13.2275 5.73242L14.2354 4.72461L18.5029 8.99219ZM6.77246 5.71289L2.92285 9.5625V10.418L6.77246 14.2676L5.76465 15.2754L1.49707 11.0078V8.97266L5.76465 4.70508L6.77246 5.71289ZM8.83496 6.27832H7.3623V3.22754H8.83496V6.27832ZM10.7119 6.27832H9.23926V3.81836H10.7119V6.27832ZM12.6377 6.27832H11.165V4.50293H12.6377V6.27832Z" fill="currentColor" />
    </svg>
  );
}

function DottedConnector() {
  return (
    <div className="relative h-px flex-1" aria-hidden="true">
      <span
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--color-foreground) 0, var(--color-foreground) 2px, transparent 2px, transparent 8px)",
        }}
      />
    </div>
  );
}

function StatusCodeBlock() {
  return (
    <div
      className="border border-[var(--color-foreground)] bg-[var(--color-background)] p-6 font-mono text-sm sm:p-8"
      style={{ borderRadius: 0 }}
    >
      <div className="space-y-1.5 text-[var(--color-foreground-secondary)]">
        <p>
          <span className="font-semibold text-[var(--color-foreground)]">HTTP/1.1</span>{" "}
          <span className="font-bold text-[var(--color-brand)]">402</span> Payment Required
        </p>
        <p className="text-xs opacity-70">Content-Type: application/json</p>
        <p className="text-xs opacity-70">Payment-Required: ...</p>
      </div>
      <div
        className="mt-4 border-l-2 border-[var(--color-rule-soft)] py-2 pl-4 text-xs leading-relaxed text-[var(--color-foreground-secondary)]"
      >
        <p>{"{"}</p>
        <p className="pl-4">
          &quot;scheme&quot;:{" "}
          <span className="text-[var(--color-brand)]">&quot;exact&quot;</span>,
        </p>
        <p className="pl-4">
          &quot;network&quot;:{" "}
          <span className="text-[var(--color-brand)]">&quot;eip155:8453&quot;</span>,
        </p>
        <p className="pl-4">
          &quot;maxAmountRequired&quot;:{" "}
          <span className="text-[var(--color-brand)]">&quot;1000000&quot;</span>
        </p>
        <p>{"}"}</p>
      </div>
    </div>
  );
}

export function HTTPNativeSection() {
  return (
    <section className="section-light py-24 md:py-32">
      <div className="mx-auto max-w-editorial px-6">
        {/* Section mark */}
        <div className="mb-10 flex items-baseline justify-between">
          <span className="editorial-mark text-base md:text-lg">N° 01</span>
          <span className="eyebrow">Mechanism</span>
        </div>

        <hr className="rule" />

        {/* Heading */}
        <h2 className="mt-12 mb-10 font-serif text-3xl leading-[1.15] text-[var(--color-foreground)] md:text-[2.75rem]">
          HTTP-native. Built into the internet.
        </h2>

        {/* Body */}
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          {/* Description column */}
          <div className="md:col-span-6">
            {/* Icon flow */}
            <div className="mb-10 flex items-center gap-4">
              <IconCircle>
                <AgentIcon />
              </IconCircle>
              <DottedConnector />
              <IconCircle>
                <TransactionIcon />
              </IconCircle>
              <DottedConnector />
              <IconCircle>
                <PunkIcon />
              </IconCircle>
            </div>

            <p className="text-base leading-[1.65] text-[var(--color-foreground-secondary)] md:text-lg">
              T402 turns HTTP 402 &ldquo;Payment Required&rdquo; into a real
              protocol. The server signals payment terms in the response;
              the client replies with a signed stablecoin authorization on
              the next request. No WebSockets, no polling, no SDK lock-in.
            </p>
          </div>

          {/* 402 response sample */}
          <div className="md:col-span-6">
            <StatusCodeBlock />
          </div>
        </div>
      </div>
    </section>
  );
}
