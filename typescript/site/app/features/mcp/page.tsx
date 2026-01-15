import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "AI Agent Payments | t402",
  description:
    "Enable AI agents to make and receive payments autonomously using the Model Context Protocol (MCP). Built for the agentic economy.",
  openGraph: {
    title: "AI Agent Payments - Model Context Protocol",
    description:
      "Autonomous payments for AI agents with budget controls, audit trails, and multi-agent support.",
  },
};

export default function MCPPage() {
  const feature = getFeatureBySlug("mcp");

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
