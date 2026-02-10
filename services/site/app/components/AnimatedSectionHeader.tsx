"use client";

import { motion } from "motion/react";
import { textStagger, fadeInUp } from "@/lib/animations";

interface AnimatedSectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: string;
  align?: "left" | "center";
  variant?: "light" | "dark";
  className?: string;
  maxDescriptionWidth?: string;
  viewportOnce?: boolean;
  descriptionSize?: "default" | "small";
}

export function AnimatedSectionHeader({
  title,
  description,
  eyebrow,
  descriptionSize = "default",
  align = "center",
  variant = "dark",
  className,
  maxDescriptionWidth,
  viewportOnce = true,
}: AnimatedSectionHeaderProps) {
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";

  const headingColor = variant === "light" ? "text-[#1A1A2E]" : "text-white";
  const subtitleColor = variant === "light" ? "text-[#4A5568]" : "text-[#A1A1AA]";

  const descriptionClass =
    descriptionSize === "small"
      ? `text-sm font-mono ${subtitleColor}`
      : `text-lg md:text-xl ${subtitleColor}`;

  return (
    <motion.div
      className={`flex flex-col gap-4 ${alignment} ${className ?? ""}`}
      variants={textStagger}
      initial="initial"
      whileInView="animate"
      viewport={{ once: viewportOnce, margin: "-80px" }}
    >
      {eyebrow && (
        <motion.span
          variants={fadeInUp}
          className="text-xs md:text-sm font-semibold uppercase tracking-widest text-[#50AF95]"
        >
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        variants={fadeInUp}
        className={`text-4xl md:text-5xl font-bold tracking-tight ${headingColor}`}
      >
        {title}
      </motion.h2>
      {description ? (
        <motion.p
          variants={fadeInUp}
          className={descriptionClass}
          style={
            maxDescriptionWidth
              ? { maxWidth: maxDescriptionWidth }
              : { maxWidth: "48rem" }
          }
        >
          {description}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
