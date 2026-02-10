import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Agent-to-Agent (A2A) | t402",
  description:
    "Enable autonomous agent-to-agent commerce using Google's A2A protocol. Agents discover services, negotiate prices, and settle payments.",
  openGraph: {
    title: "Agent-to-Agent (A2A) - Inter-Agent Commerce Protocol",
    description:
      "Agents can discover services, negotiate prices, and settle payments without human intervention using Google's A2A protocol.",
  },
};

export default function A2APage() {
  const feature = getFeatureBySlug("a2a");

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
