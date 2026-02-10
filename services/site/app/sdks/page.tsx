import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import SDKsClient from "./SDKsClient";

export const metadata = {
  title: "SDKs | t402",
  description:
    "Official t402 SDKs for TypeScript, Python, Go, and Java. Production-ready libraries for integrating HTTP-native USDT payments into your applications.",
  openGraph: {
    title: "t402 SDKs - Official Libraries",
    description:
      "Production-ready SDKs for TypeScript, Python, Go, and Java. Integrate t402 payments in minutes.",
  },
};

export default function SDKsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0A0A0B", color: "#FAFAFA" }}>
      <NavBar />
      <main>
        <SDKsClient />
      </main>
      <Footer />
    </div>
  );
}
