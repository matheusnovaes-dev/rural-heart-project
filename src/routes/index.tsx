import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";

const searchSchema = z.object({
  // "1" = veio do link "prefere assinar direto" — os botões de plano abaixo
  // devem pular o teste grátis e cobrar imediatamente.
  semTrial: z.literal("1").optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: Index,
});

function Index() {
  const { semTrial } = Route.useSearch();

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
        <Pricing semTrial={semTrial === "1"} />
        <FinalCta />
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </div>
  );
}
