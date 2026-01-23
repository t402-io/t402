"use client";

import { useEffect } from "react";
import { useNavigation, sections, type SectionId } from "@/providers/NavigationProvider";
import { useDemoContext } from "@/providers/DemoProvider";

export function useKeyboardNav() {
  const { navigateNext, navigatePrev, setActiveSection, togglePresenterMode } = useNavigation();
  const { setMode, mode } = useDemoContext();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          navigateNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigatePrev();
          break;
        case "f":
        case "F":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            togglePresenterMode();
          }
          break;
        case "d":
        case "D":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setMode(mode === "live" ? "demo" : "live");
          }
          break;
        case "Escape":
          e.preventDefault();
          togglePresenterMode();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7": {
          const idx = parseInt(e.key) - 1;
          if (idx < sections.length) {
            e.preventDefault();
            setActiveSection(sections[idx].id as SectionId);
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateNext, navigatePrev, setActiveSection, togglePresenterMode, setMode, mode]);
}
