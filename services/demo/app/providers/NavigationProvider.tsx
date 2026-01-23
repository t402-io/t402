"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export const sections = [
  { id: "overview", label: "Overview", color: "#50AF95" },
  { id: "protocol", label: "Protocol", color: "#3B82F6" },
  { id: "transports", label: "Transports", color: "#8B5CF6" },
  { id: "chains", label: "Chains", color: "#10B981" },
  { id: "sdks", label: "SDKs", color: "#06B6D4" },
  { id: "advanced", label: "Advanced", color: "#F59E0B" },
  { id: "status", label: "Status", color: "#50AF95" },
] as const;

export type SectionId = (typeof sections)[number]["id"];

interface NavigationContextValue {
  activeSection: SectionId;
  setActiveSection: (id: SectionId) => void;
  navigateNext: () => void;
  navigatePrev: () => void;
  presenterMode: boolean;
  togglePresenterMode: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [presenterMode, setPresenterMode] = useState(false);

  const navigateNext = useCallback(() => {
    const idx = sections.findIndex((s) => s.id === activeSection);
    if (idx < sections.length - 1) {
      setActiveSection(sections[idx + 1].id);
    }
  }, [activeSection]);

  const navigatePrev = useCallback(() => {
    const idx = sections.findIndex((s) => s.id === activeSection);
    if (idx > 0) {
      setActiveSection(sections[idx - 1].id);
    }
  }, [activeSection]);

  const togglePresenterMode = useCallback(() => {
    setPresenterMode((p) => {
      const next = !p;
      if (next) {
        document.documentElement.classList.add("presenter-mode");
      } else {
        document.documentElement.classList.remove("presenter-mode");
      }
      return next;
    });
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        activeSection,
        setActiveSection,
        navigateNext,
        navigatePrev,
        presenterMode,
        togglePresenterMode,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
