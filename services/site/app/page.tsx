import { NavBar } from "./components/NavBar";
import { Hero } from "./components/Hero";
import { ChainLogoBar } from "./components/ChainLogoBar";
import { HTTPNativeSection } from "./components/HTTPNativeSection";
import { FeatureBento } from "./components/FeatureBento";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <Hero />
      <ChainLogoBar />
      <HTTPNativeSection />
      <FeatureBento />
      <CTA />
      <Footer />
    </div>
  );
}
