"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BackgroundVideo } from "./BackgroundVideo";

const stats = [
  { value: "33", label: "Chains" },
  { value: "4", label: "SDKs" },
  { value: "$0", label: "Fees" },
  { value: "<1s", label: "Settlement" },
];

export function Hero() {
  return (
    <section className="section-dark relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Video background */}
      <BackgroundVideo src="/videos/neonblobs.mp4" />

      {/* Dark overlay gradient */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,11,0.6) 0%, rgba(10,10,11,0.4) 40%, rgba(10,10,11,0.7) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-[2] mx-auto max-w-7xl px-6 py-32 text-center">
        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl font-bold tracking-tight text-white md:text-7xl lg:text-8xl"
        >
          The Payment Protocol
          <br />
          <span className="text-gradient">for USDT</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-2xl text-lg text-foreground-secondary md:text-xl"
        >
          HTTP-native stablecoin payments across 33 blockchains. Zero fees.
          Instant settlement. Built for AI agents.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="https://docs.t402.io/getting-started/quickstart"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-[#0A0A0B] transition-all hover:bg-brand-secondary hover:shadow-glow"
          >
            Get Started
          </Link>
          <Link
            href="https://t402.io/t402-whitepaper.pdf"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 px-8 py-4 text-lg font-semibold text-white backdrop-blur transition-all hover:border-white/40 hover:bg-white/5"
          >
            Read Whitepaper
          </Link>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 flex items-center justify-center"
        >
          <div className="flex items-center divide-x divide-white/20">
            {stats.map((stat) => (
              <div key={stat.label} className="px-6 text-center sm:px-10">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-foreground-secondary">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 z-[2] -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-xs tracking-widest text-foreground-tertiary uppercase">
            Scroll
          </span>
          <svg
            className="h-5 w-5 text-foreground-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 14l-7 7m0 0l-7-7"
            />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}
