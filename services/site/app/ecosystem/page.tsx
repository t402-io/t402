import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import EcosystemClient from "./EcosystemClient";

export const metadata = {
  title: "Ecosystem | t402",
  description:
    "25+ packages across TypeScript, Go, Python, and Java. Chain mechanisms, HTTP middleware, UI components, wallet integrations, and AI agent tools.",
  openGraph: {
    title: "t402 Ecosystem - Packages & Integrations",
    description:
      "Complete ecosystem of payment packages: 9 chain mechanisms, 4 HTTP middleware, UI components, wallet integrations, and AI agent tools.",
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
