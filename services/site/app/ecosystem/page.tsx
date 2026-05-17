import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import EcosystemClient from "./EcosystemClient";

export const metadata = {
  title: "Ecosystem | t402",
  description:
    "47+ open-source packages across TypeScript, Go, Python, and Java. Chain mechanisms, HTTP middleware, AI agents, wallets, and infrastructure integrations.",
  openGraph: {
    title: "t402 Ecosystem - Packages & Integrations",
    description:
      "Complete ecosystem: 47+ open-source packages and integrations across the stablecoin payments stack.",
  },
};

export default function EcosystemPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <EcosystemClient />
      </main>
      <Footer />
    </div>
  );
}
