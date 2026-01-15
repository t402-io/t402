"use client";

import { motion } from "motion/react";
import Image from "next/image";

const testimonials = [
  {
    quote:
      "T402 transformed how we monetize our AI APIs. Integration took less than an hour and we're now processing thousands of micro-payments daily.",
    author: "Alex Chen",
    title: "CTO",
    company: "Heurist AI",
    logo: "/logos/heurist-mesh.png",
    avatar: null,
  },
  {
    quote:
      "The gasless payment feature is a game-changer. Our users can pay for premium content without worrying about gas fees or even knowing they're using blockchain.",
    author: "Sarah Miller",
    title: "Product Lead",
    company: "Firecrawl",
    logo: "/logos/firecrawl.png",
    avatar: null,
  },
  {
    quote:
      "We evaluated several payment protocols for our AI agent infrastructure. T402's MCP integration made it the clear choice - our agents can now autonomously pay for services.",
    author: "David Park",
    title: "Founder",
    company: "Questflow",
    logo: "/logos/questflow.png",
    avatar: null,
  },
  {
    quote:
      "Multi-chain support was critical for us. T402 lets our users pay with USDT on whichever chain they prefer - Base, Arbitrum, TON, or TRON.",
    author: "Maria Santos",
    title: "Engineering Lead",
    company: "Grove API",
    logo: "/logos/grove-api-logo.png",
    avatar: null,
  },
];

export function Testimonials() {
  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Trusted by Builders
          </h2>
          <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
            See what developers and teams are saying about T402
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 bg-background-secondary rounded-2xl border border-border hover:border-brand/30 transition-colors"
            >
              {/* Quote */}
              <div className="mb-6">
                <svg
                  className="w-8 h-8 text-brand/40 mb-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="text-foreground-secondary text-lg leading-relaxed">
                  {testimonial.quote}
                </p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-background-tertiary border border-border flex items-center justify-center overflow-hidden">
                  {testimonial.logo ? (
                    <Image
                      src={testimonial.logo}
                      alt={testimonial.company}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-lg font-bold text-brand">
                      {testimonial.author[0]}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-foreground-secondary">
                    {testimonial.title} at {testimonial.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Social Proof Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-8 px-8 py-4 bg-background-secondary rounded-full border border-border">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-foreground font-medium">4.9/5 Developer Rating</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-foreground font-medium">&lt;15 min Integration</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-foreground font-medium">99.9% Uptime</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
