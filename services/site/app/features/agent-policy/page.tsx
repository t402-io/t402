import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Agent Policy Engine | t402",
  description:
    "Define fine-grained spending policies for autonomous AI agents. Control budgets, recipients, time windows, and approval thresholds.",
  openGraph: {
    title: "Agent Policy Engine - Declarative Spending Rules for AI Wallets",
    description:
      "Set per-transaction limits, daily budgets, recipient allowlists, and hierarchical permissions for AI agent wallets.",
  },
};

export default function AgentPolicyPage() {
  const feature = getFeatureBySlug("agent-policy");

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
