"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

interface FAQItem {
  question: string;
  answer?: ReactNode;
}

interface FAQProps {
  variant?: "light" | "dark";
}

const faqData: FAQItem[] = [
  {
    question: "What is t402 used for?",
    answer:
      "t402 enables instant, low-cost payments for digital services. It's designed for API monetization, agentic commerce, paywalled content, and any scenario where traditional payment methods are too slow or expensive.",
  },
  {
    question: "Is t402 production ready?",
    answer:
      "Yes, t402 is production-ready and has processed millions of transactions. The protocol is open-source and has been audited for security.",
  },
  {
    question: "How do I integrate t402?",
    answer:
      <>
        Integration is simple - add a single line of middleware to your server.
        Check our{" "}
        <a
          className="underline"
          href="https://docs.t402.io/getting-started/quickstart"
          target="_blank"
          rel="noreferrer"
        >
          documentation
        </a>{" "}
        for detailed guides and examples in multiple programming languages.
      </>,
  },
  {
    question: "What blockchains does t402 support?",
    answer:
      "t402 is blockchain-agnostic and supports all EVM-compatible chains, Solana, and more. Stablecoin payments are the primary use case. t402 is also extensible to traditional payment methods.",
  },
];

function ToggleIcon({ open, variant }: { open: boolean; variant: "light" | "dark" }) {
  const color = "#50AF95";
  return (
    <div
      className="w-10 h-10 flex items-center justify-center flex-shrink-0 transition-transform duration-300"
      style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function FAQ({ variant = "dark" }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number>(-1);
  const isLight = variant === "light";

  const toggleItem = (index: number) => {
    setOpenIndex((current) => (current === index ? -1 : index));
  };

  const borderColor = isLight
    ? "border-[rgba(0,0,0,0.08)]"
    : "border-white/[0.06]";
  const hoverBg = isLight ? "hover:bg-[#F7FAF9]" : "hover:bg-white/[0.02]";
  const questionColor = isLight ? "text-[#1A1A2E]" : "text-white";
  const answerColor = isLight ? "text-[#4A5568]" : "text-[#A1A1AA]";

  return (
    <div className="w-full" aria-label="Frequently asked questions">
      <div>
        {faqData.map((item, index) => (
          <div key={index} className={`border-b ${borderColor}`}>
            <button
              onClick={() => toggleItem(index)}
              className={`w-full flex cursor-pointer justify-between items-center py-6 px-2 ${hoverBg} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#50AF95]`}
              aria-expanded={openIndex === index}
              aria-controls={`faq-answer-${index}`}
            >
              <h3 className={`text-lg font-semibold text-left ${questionColor}`}>
                {item.question}
              </h3>
              <ToggleIcon open={openIndex === index} variant={variant} />
            </button>

            <AnimatePresence initial={false}>
              {openIndex === index && item.answer && (
                <motion.div
                  id={`faq-answer-${index}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-2 pb-6">
                    <p className={`text-base leading-relaxed ${answerColor}`}>
                      {item.answer}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
