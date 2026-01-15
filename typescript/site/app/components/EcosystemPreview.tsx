"use client";

import { motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";

const featuredPartners = [
  { name: "Firecrawl", logo: "/logos/firecrawl.png" },
  { name: "Pinata", logo: "/logos/pinata.png" },
  { name: "Neynar", logo: "/logos/neynar.png" },
  { name: "AltLayer", logo: "/logos/AltLayer_logo.png" },
  { name: "Thirdweb", logo: "/logos/thirdweb-logo.png" },
  { name: "Heurist", logo: "/logos/heurist-mesh.png" },
  { name: "Grove API", logo: "/logos/grove-api-logo.png" },
  { name: "Questflow", logo: "/logos/questflow.png" },
];

export function EcosystemPreview() {
  return (
    <section className="py-24 px-4 bg-background-secondary overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Growing Ecosystem
          </h2>
          <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
            Join 50+ projects already using T402 for USDT payments
          </p>
        </motion.div>

        {/* Infinite scrolling logo marquee */}
        <div className="relative mb-12">
          {/* Gradient masks */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background-secondary to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background-secondary to-transparent z-10 pointer-events-none" />

          {/* Scrolling container */}
          <motion.div
            className="flex gap-12"
            animate={{ x: [0, -1200] }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {/* Duplicate logos for seamless loop */}
            {[...featuredPartners, ...featuredPartners, ...featuredPartners].map((partner, index) => (
              <div
                key={`${partner.name}-${index}`}
                className="flex-shrink-0 w-32 h-16 flex items-center justify-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
              >
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={120}
                  height={48}
                  className="object-contain max-h-12"
                />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12"
        >
          {[
            { value: "50+", label: "Integrations" },
            { value: "10", label: "Supported Chains" },
            { value: "5", label: "SDK Languages" },
            { value: "24/7", label: "Facilitator Uptime" },
          ].map((stat, index) => (
            <div key={index} className="text-center p-6 bg-background-tertiary rounded-xl border border-border">
              <div className="text-3xl font-bold text-brand mb-1">{stat.value}</div>
              <div className="text-sm text-foreground-secondary">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center"
        >
          <Link
            href="/ecosystem"
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand text-background font-semibold rounded-lg hover:bg-brand-secondary transition-colors"
          >
            Explore Ecosystem
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
