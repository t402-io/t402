"use client";

import { useFacilitatorStatus } from "@/hooks/useFacilitatorStatus";
import { Spinner } from "@/components/shared/Spinner";

export function FacilitatorBadge() {
  const { online, supportedKinds, loading } = useFacilitatorStatus();

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
        <Spinner size="sm" color="#71717A" />
        Checking...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: online ? "var(--color-success)" : "var(--color-error)" }}
      />
      <span style={{ color: online ? "var(--color-success)" : "var(--color-error)" }}>
        {online ? `Facilitator (${supportedKinds} kinds)` : "Facilitator offline"}
      </span>
    </div>
  );
}
