"use client";

import { useState, useEffect } from "react";

interface FacilitatorStatus {
  online: boolean;
  supportedKinds: number;
  url: string;
}

export function useFacilitatorStatus() {
  const [status, setStatus] = useState<FacilitatorStatus>({
    online: false,
    supportedKinds: 0,
    url: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch("/api/status");
        const data = await res.json();
        if (mounted) {
          setStatus({
            online: data.facilitator?.online ?? false,
            supportedKinds: data.facilitator?.supportedKinds ?? 0,
            url: data.facilitator?.url ?? "",
          });
        }
      } catch {
        if (mounted) {
          setStatus((prev) => ({ ...prev, online: false }));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    check();
    const interval = setInterval(check, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { ...status, loading };
}
