import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import StatusClient from "./StatusClient";

export const metadata = {
  title: "Network Status | t402",
  description:
    "t402 facilitator service status, supported networks, and wallet addresses. Real-time monitoring via Grafana dashboard.",
  openGraph: {
    title: "t402 Network Status",
    description:
      "Facilitator health, supported blockchain networks, and service endpoints for the t402 payment protocol.",
  },
};

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <StatusClient />
      </main>
      <Footer />
    </div>
  );
}
