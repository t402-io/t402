import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import SDKsClient from "./SDKsClient";

export const metadata = {
  title: "SDKs | t402",
  description:
    "Official t402 SDKs for TypeScript, Python, and Go. Production-ready libraries for integrating internet-native payments into your applications.",
  openGraph: {
    title: "t402 SDKs - Official Libraries",
    description:
      "Production-ready SDKs for TypeScript, Python, and Go. Integrate t402 payments in minutes.",
  },
};

export default function SDKsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <SDKsClient />
      </main>
      <Footer />
    </div>
  );
}
