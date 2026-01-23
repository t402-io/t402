"use client";

import { useFacilitatorStatus } from "@/hooks/useFacilitatorStatus";

export function FacilitatorBadge() {
  const { online, supportedNetworks, loading } = useFacilitatorStatus();

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-muted)] animate-pulse" />
        Checking...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${
          online ? "bg-green-400" : "bg-red-400"
        }`}
      />
      <span className={online ? "text-green-400" : "text-red-400"}>
        {online ? `Facilitator (${supportedNetworks} networks)` : "Facilitator offline"}
      </span>
    </div>
  );
}
