import { DesktopFXLoader } from "@/components/landing/desktop/DesktopFXLoader";
import { FaixaGigante } from "@/components/landing/FaixaGigante";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Header } from "@/components/landing/Header";
import { PrecosCarrossel } from "@/components/landing/PrecosCarrossel";
import { Hero } from "@/components/landing/Hero";
import { CalculadoraSafraLanding } from "@/components/landing/CalculadoraSafraLanding";
import { Solution } from "@/components/landing/Solution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { TrustProof } from "@/components/landing/TrustProof";
import { Pricing } from "@/components/landing/Pricing";
import { Faq } from "@/components/landing/Faq";
import { RastreioScroll } from "@/components/landing/RastreioScroll";
import { perguntasFrequentes } from "@/config/faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import { BarraCtaFixa } from "@/components/landing/BarraCtaFixa";
import { CadastroProvider } from "@/components/landing/CadastroProvider";

import { paramLiteral } from "@/lib/searchParams";

const searchSchema = z.object({
  // "1" = veio do link "prefere assinar direto" — os botões de plano abaixo
  // devem pular o teste grátis e cobrar imediatamente.
  semTrial: paramLiteral("1"),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    scripts: [
      {
        // FAQPage: as mesmas perguntas da seção "Perguntas frequentes".
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: perguntasFrequentes.map((p) => ({
            "@type": "Question",
            name: p.pergunta,
            acceptedAnswer: { "@type": "Answer", text: p.resposta },
          })),
        }),
      },
    ],
  }),
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
          <PrecosCarrossel />
          <Solution />
          <CalculadoraSafraLanding />
          <HowItWorks />
          <FaixaGigante />
          <DashboardPreview />
          <TrustProof />
          <Pricing semTrial={semTrial === "1"} />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
        <RastreioScroll />
        <DesktopFXLoader />
        <BarraCtaFixa />
        <WhatsAppFloatingButton />
      </div>
    </CadastroProvider>
  );
}
