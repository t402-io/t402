"use client";

import { lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigation } from "@/providers/NavigationProvider";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { NavRail } from "@/components/navigation/NavRail";
import { SectionHeader } from "@/components/navigation/SectionHeader";

const OverviewSection = lazy(() => import("@/components/sections/OverviewSection"));
const ProtocolSection = lazy(() => import("@/components/sections/ProtocolSection"));
const TransportsSection = lazy(() => import("@/components/sections/TransportsSection"));
const ChainAtlasSection = lazy(() => import("@/components/sections/ChainAtlasSection"));
const SdkGallerySection = lazy(() => import("@/components/sections/SdkGallerySection"));
const AdvancedSection = lazy(() => import("@/components/sections/AdvancedSection"));
const StatusSection = lazy(() => import("@/components/sections/StatusSection"));

function SectionFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
    </div>
  );
}

export default function DemoPage() {
  const { activeSection } = useNavigation();
  useKeyboardNav();

  return (
    <div className="flex h-screen overflow-hidden">
      <NavRail />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SectionHeader />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              <Suspense fallback={<SectionFallback />}>
                {activeSection === "overview" && <OverviewSection />}
                {activeSection === "protocol" && <ProtocolSection />}
                {activeSection === "transports" && <TransportsSection />}
                {activeSection === "chains" && <ChainAtlasSection />}
                {activeSection === "sdks" && <SdkGallerySection />}
                {activeSection === "advanced" && <AdvancedSection />}
                {activeSection === "status" && <StatusSection />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
