"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

interface CostTickerProps {
  totalCost: number;
  currency?: string;
  className?: string;
  animate?: boolean;
}

export function CostTicker({ totalCost, currency = "USDT", className, animate = true }: CostTickerProps) {
  const [displayCost, setDisplayCost] = useState(totalCost);

  useEffect(() => {
    if (!animate) {
      setDisplayCost(totalCost);
      return;
    }
    const interval = setInterval(() => {
      setDisplayCost((prev) => {
        const diff = totalCost - prev;
        if (Math.abs(diff) < 0.000001) return totalCost;
        return prev + diff * 0.3;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [totalCost, animate]);

  return (
    <div className={clsx("inline-flex items-center gap-1.5", className)}>
      <span className="text-xs text-[var(--color-muted)]">Total spent:</span>
      <span className="text-sm font-mono font-semibold text-[var(--color-brand)]">
        {displayCost.toFixed(6)} {currency}
      </span>
    </div>
  );
}
