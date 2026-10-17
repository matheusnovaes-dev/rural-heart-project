import { MIDIA } from "@/assets/midia";
import { IntroAssinatura } from "@/components/landing/IntroAssinatura";
import { FundoDosCapitulos } from "@/components/landing/FundoDosCapitulos";
import { MapaBrasilFundo } from "@/components/landing/MapaBrasilFundo";
import { DesktopFXLoader } from "@/components/landing/desktop/DesktopFXLoader";
import { FaixaGigante } from "@/components/landing/FaixaGigante";
import { createFileRoute } from "@tanstack/react-router";

import { Header } from "@/components/landing/Header";
import { PrecosCarrossel } from "@/components/landing/PrecosCarrossel";
import { Hero } from "@/components/landing/Hero";
import { CalculadoraSafraLanding } from "@/components/landing/CalculadoraSafraLanding";
import { Solution } from "@/components/landing/Solution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { TrustProof } from "@/components/landing/TrustProof";
import { FaixaDeFotos } from "@/components/landing/FaixaDeFotos";
import { Pricing } from "@/components/landing/Pricing";
import { Faq } from "@/components/landing/Faq";
import { RastreioScroll } from "@/components/landing/RastreioScroll";
import { perguntasFrequentes } from "@/config/faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import { BarraCtaFixa } from "@/components/landing/BarraCtaFixa";
import { CadastroProvider } from "@/components/landing/CadastroProvider";

import { lerLiteral, parametros } from "@/lib/searchParams";

// "1" = veio do link "prefere assinar direto" — os botões de plano abaixo
// devem pular o teste grátis e cobrar imediatamente.
const validarBusca = (busca: Record<string, unknown>) =>
  parametros({ semTrial: lerLiteral(busca["semTrial"], "1") });

export const Route = createFileRoute("/")({
  validateSearch: validarBusca,
  head: () => ({
    links: [
      // A foto do hero é o LCP em todos os tamanhos de tela. Sem isto ela só era pedida depois dos scripts e fontes, e em
      // rede lenta ficava para trás. Cada preload só vale para a faixa de tela da versão que o <picture> escolheria.
      {
        rel: "preload",
        as: "image",
        href: MIDIA.hero828,
        type: "image/webp",
        media: "(max-width: 640px)",
        fetchPriority: "high" as const,
      },
      {
        rel: "preload",
        as: "image",
        href: MIDIA.hero1000Webp,
        type: "image/webp",
        media: "(min-width: 641px) and (max-width: 1099px)",
        fetchPriority: "high" as const,
      },
      {
        rel: "preload",
        as: "image",
        href: MIDIA.hero1920,
        type: "image/webp",
        media: "(min-width: 1100px)",
        fetchPriority: "high" as const,
      },
    ],
    scripts: [
      {
        // Decide, ANTES da primeira pintura, se a abertura com a assinatura roda: só desktop de verdade (tela larga, mouse,
        // sem "reduzir movimento", rede e máquina boas), só na primeira visita, e nunca em link com #âncora ou ?sem_intro.
        // Põe a classe `intro-ativa` no <html>; sem ela a cobertura é display:none (ver IntroAssinatura.tsx e styles.css).
        children: `(function(){try{var h=document.documentElement,m=function(q){return matchMedia(q).matches},c=navigator.connection||{};if(innerWidth>=1024&&m("(hover:hover) and (pointer:fine)")&&!m("(prefers-reduced-motion: reduce)")&&!c.saveData&&!/(^|slow-)2g|3g/.test(c.effectiveType||"")&&(navigator.hardwareConcurrency||4)>=4&&(navigator.deviceMemory||8)>=4&&!localStorage.getItem("safralume_intro_visto")&&!location.hash&&!/[?&]sem_intro/.test(location.search))h.classList.add("intro-ativa")}catch(e){}})()`,
      },
      {
        // Antes da página "acordar" (hidratar), o formulário do hero é HTML puro: em celular lento tocar no botão recarregava a
        // página (GET /?whatsapp=...) e apagava o número digitado, sem abrir o cadastro. Aqui o envio fica guardado (campo
        // + pedido de envio) e o CampoWhatsappCta o executa assim que hidrata; o botão mostra "aguardando" por atributo.
        children: `(function(){var P=window.__pre={};document.addEventListener("input",function(e){var t=e.target;if(t&&t.name==="whatsapp"&&t.form){for(var k in t.form)if(k.indexOf("__reactProps")===0)return;P.v=t.value;P.f=t.form}},true);document.addEventListener("submit",function(e){var f=e.target;if(!f||!f.querySelector||!f.querySelector("input[name=whatsapp]"))return;for(var k in f)if(k.indexOf("__reactProps")===0)return;e.preventDefault();e.stopPropagation();var i=f.querySelector("input[name=whatsapp]");P.v=i.value;P.f=f;P.s=1;var b=f.querySelector("button[type=submit]");if(b)b.setAttribute("data-aguardando","1")},true)})()`,
      },
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
      <div className="fundo-capitulos min-h-screen bg-background">
        <IntroAssinatura />
        <Header />
        <main>
          <Hero />
          <PrecosCarrossel />
          <Solution />
          <MapaBrasilFundo>
            <CalculadoraSafraLanding />
            <HowItWorks />
          </MapaBrasilFundo>
          <FaixaGigante />
          <DashboardPreview />
          <TrustProof />
          <FaixaDeFotos />
          <Pricing semTrial={semTrial === "1"} />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
        <RastreioScroll />
        <FundoDosCapitulos />
        <DesktopFXLoader />
        <BarraCtaFixa />
        <WhatsAppFloatingButton />
      </div>
    </CadastroProvider>
  );
}
