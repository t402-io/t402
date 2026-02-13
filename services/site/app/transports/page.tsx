import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import TransportsClient from "./TransportsClient";

export const metadata = {
  title: "Payment Transports | t402",
  description:
    "HTTP, MCP, and A2A payment transports. One protocol for web APIs, AI agents, and agent-to-agent commerce across 50 networks.",
  openGraph: {
    title: "t402 Payment Transports - HTTP, MCP, A2A",
    description:
      "Three transport protocols for web APIs, AI agents, and autonomous agent commerce. Same payment logic, any integration pattern.",
  },
};

export default function TransportsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <TransportsClient />
      </main>
      <Footer />
    </div>
  );
}
