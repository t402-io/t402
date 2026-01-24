"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type DemoMode = "live" | "demo";

interface DemoContextValue {
  mode: DemoMode;
  setMode: (mode: DemoMode) => void;
  isLive: boolean;
  isDemo: boolean;
  facilitatorUrl: string;
  testnet: boolean;
}

const DemoContext = createContext<DemoContextValue>({
  mode: "demo",
  setMode: () => {},
  isLive: false,
  isDemo: true,
  facilitatorUrl: "https://facilitator.t402.io",
  testnet: true,
});

export function useDemoContext() {
  return useContext(DemoContext);
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DemoMode>(
    (process.env.NEXT_PUBLIC_DEMO_MODE as DemoMode) || "demo"
  );

  // Sync from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem("t402-demo-mode") as DemoMode | null;
    if (stored && (stored === "live" || stored === "demo")) {
      setModeState(stored);
    }
  }, []);

  const setMode = (newMode: DemoMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("t402-demo-mode", newMode);
    }
  };

  const value: DemoContextValue = {
    mode,
    setMode,
    isLive: mode === "live",
    isDemo: mode === "demo",
    facilitatorUrl: process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://facilitator.t402.io",
    testnet: process.env.NEXT_PUBLIC_TESTNET === "true",
  };

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
}
