import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { CalculadoraSafraLanding } from "@/components/landing/CalculadoraSafraLanding";
import { PainPoints } from "@/components/landing/PainPoints";
import { Solution } from "@/components/landing/Solution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { TrustProof } from "@/components/landing/TrustProof";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import { BarraCtaFixa } from "@/components/landing/BarraCtaFixa";
import { CadastroProvider } from "@/components/landing/CadastroProvider";

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
    <CadastroProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <Hero />
          <CalculadoraSafraLanding />
          <PainPoints />
          <Solution />
          <HowItWorks />
          <DashboardPreview />
          <TrustProof />
          <Pricing semTrial={semTrial === "1"} />
          <FinalCta />
        </main>
        <Footer />
        <BarraCtaFixa />
        <WhatsAppFloatingButton />
      </div>
    </CadastroProvider>
  );
}
