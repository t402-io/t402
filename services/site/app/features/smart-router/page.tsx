import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Smart Payment Router | t402",
  description:
    "Automatically find the cheapest and fastest payment path across all supported chains. Considers gas costs, bridge fees, and settlement time.",
  openGraph: {
    title: "Smart Payment Router - Optimal Path Finding Across Chains",
    description:
      "Best-price execution with multi-hop routing, fallback chains, and full fee transparency across 30+ chains.",
  },
};

export default function SmartRouterPage() {
  const feature = getFeatureBySlug("smart-router");

  if (!feature) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <FeaturePageClient feature={feature} />
      </main>
      <Footer />
    </div>
  );
}
