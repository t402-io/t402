import { NavBar } from "./components/NavBar";
import { Hero } from "./components/Hero";
import { ChainLogoBar } from "./components/ChainLogoBar";
import { HTTPNativeSection } from "./components/HTTPNativeSection";
import { HowItWorks } from "./components/HowItWorks";
import { CodeExamples } from "./components/CodeExamples";
import { NetworkGrid } from "./components/NetworkGrid";
import { FeatureBento } from "./components/FeatureBento";
import { WhyT402 } from "./components/WhyT402";
import { SDKShowcase } from "./components/SDKShowcase";
import { UseCasesPreview } from "./components/UseCasesPreview";
import { Stats } from "./components/Stats";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <Hero />
      <ChainLogoBar />
      <HTTPNativeSection />
      <HowItWorks />
      <CodeExamples />
      <NetworkGrid />
      <FeatureBento />
      <WhyT402 />
      <SDKShowcase />
      <UseCasesPreview />
      <Stats />
      <CTA />
      <Footer />
    </div>
  );
}
