import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Intent-Based Payments | t402",
  description:
    "Express payment intents and let a network of solvers compete to fulfill them optimally. MEV-protected, cross-chain execution.",
  openGraph: {
    title: "Intent-Based Payments - Solver Network for Optimal Execution",
    description:
      "Express what you want, let solvers find the best path. MEV-protected, cross-chain, and gas-optimized payment execution.",
  },
};

export default function IntentPaymentsPage() {
  const feature = getFeatureBySlug("intent-payments");

  if (!feature) {
    notFound();
  }

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0B", color: "#FAFAFA" }}>
      <NavBar />
      <main>
        <FeaturePageClient feature={feature} />
      </main>
      <Footer />
    </div>
  );
}
