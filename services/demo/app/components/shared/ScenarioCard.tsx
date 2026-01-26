"use client";

import Link from "next/link";
import clsx from "clsx";

interface ScenarioCardProps {
  id: string;
  title: string;
  description: string;
  cost: string;
  icon: React.ReactNode;
  accentColor: string;
  href: string;
}

export function ScenarioCard({ title, description, cost, icon, accentColor, href }: ScenarioCardProps) {
  return (
    <Link
      href={href}
      className="glass-card-interactive p-4 sm:p-5 block group active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}20`, color: accentColor }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold group-hover:text-white transition-colors">{title}</h3>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {cost}
          </span>
        </div>
      </div>
      <p className="text-xs text-[var(--color-muted)] leading-relaxed line-clamp-2">
        {description}
      </p>
    </Link>
  );
}
