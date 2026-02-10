import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Streaming Payments | t402",
  description:
    "Enable continuous payment streams for ongoing resource access. Charge per-second, per-request, or per-byte with automatic top-up.",
  openGraph: {
    title: "Streaming Payments - Pay-Per-Second for Continuous Access",
    description:
      "Granular billing with real-time metering, auto-topup, and instant settlement for ongoing resource consumption.",
  },
};

export default function StreamingPage() {
  const feature = getFeatureBySlug("streaming");

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
