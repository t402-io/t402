"use client";

import { useState, useEffect } from "react";
import { Activity, Globe, Shield, Layers } from "lucide-react";

interface Stats {
  kinds: number;
  online: boolean;
}

export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        setStats({
          kinds: d.facilitator?.supportedKinds || 0,
          online: d.facilitator?.online || false,
        });
      })
      .catch(() => {});
  }, []);

  const items = [
    { icon: Globe, value: "44", label: "Networks", suffix: "" },
    { icon: Layers, value: stats ? String(stats.kinds) : "\u2014", label: "Payment Kinds", suffix: "" },
    { icon: Shield, value: "13", label: "Mechanisms", suffix: "" },
    { icon: Activity, value: "4", label: "SDKs", suffix: "" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
      {items.map((item) => (
        <div
          key={item.label}
          className="text-center p-4 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <item.icon size={16} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} aria-hidden="true" />
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {item.value}{item.suffix}
          </div>
          <div className="text-[10px] sm:text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
