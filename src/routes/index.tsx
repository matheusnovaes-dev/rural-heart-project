import { createFileRoute } from "@tanstack/react-router";

import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { PainPoints } from "@/components/landing/PainPoints";
import { Solution } from "@/components/landing/Solution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { TrustProof } from "@/components/landing/TrustProof";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <PainPoints />
        <Solution />
        <HowItWorks />
        <DashboardPreview />
        <TrustProof />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
