import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import EcosystemClient from "./EcosystemClient";

export const metadata = {
  title: "Ecosystem | t402",
  description:
    "47+ packages across TypeScript, Go, Python, and Java. 14 chain mechanisms, HTTP middleware, UI components, wallet integrations, AI agent tools, and developer utilities.",
  openGraph: {
    title: "t402 Ecosystem - Packages & Integrations",
    description:
      "Complete ecosystem of payment packages: 14 chain mechanisms, 5 HTTP middleware, UI components, wallet integrations, and AI agent tools.",
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
