import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth";
import { Toaster } from "../components/ui/sonner";
import { CookieConsent } from "../components/CookieConsent";
import { pricingPlans } from "../config/site";
import { capturarOrigem } from "../lib/origem";
import { FONTES_PAINEL_URL } from "../lib/fontes";

// Fontes em duas levas (auditoria de performance 2026-10-13: FCP de 3,9s em 4G
// lento e CSS do Google Fonts bloqueando a renderização com 5 famílias). Só o
// que aparece na primeira tela (títulos e texto corrido) bloqueia; DM Sans e
// Space Grotesk (escopo do painel), e IBM Plex Mono (números), entram logo
// depois da hidratação, sem travar o primeiro desenho. font-display: swap em
// ambas, então nada some enquanto carrega.
const FONTES_CRITICAS_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
const FONTES_MONO_LANDING_URL =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap";

// No painel (/dashboard) o que aparece é DM Sans e Space Grotesk; Bricolage e IBM Plex Sans (da landing) não são
// usadas ali e bloqueavam o primeiro desenho por ~115 KB. Lá a ordem inverte: as do painel são as críticas e as da
// landing entram depois da hidratação (só para modais e telas fora do painel).
const FONTES_MONO_URL =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap";

// Só as letras dos títulos grandes do carrossel de preços (serifa de alto contraste e traço de pincel):
// o parâmetro text= entrega poucos KB em vez da família inteira.
const FONTES_DESTAQUE_URL =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Caveat+Brush&text=%26%3F%21%2C.-%2F0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ%C3%87%C3%83%C3%81%C3%80%C3%82%C3%89%C3%8A%C3%8D%C3%93%C3%94%C3%95%C3%9Ahojegr%C3%A1tis&display=swap";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Tente atualizar a página ou volte para o início. Se
          continuar, chame a gente no WhatsApp: +55 31 9004-0215.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Achado real 2026-10-12 (print do Matheus): sem essa tag, o Safari no
      // iOS pinta a faixa entre a barra de endereço e o topo da página com
      // uma cor própria (preta), que não bate com o verde escuro do header
      // — fica um "contorno preto estranho" bem visível. Primeira tentativa
      // usou oklch() (mesma cor do BrandBackdrop) e não resolveu no device
      // real — o parser de theme-color do Safari é mais conservador que o
      // motor de CSS da página e não entende oklch() nesse contexto
      // específico. #05130a é o hex equivalente exato (convertido), suporte
      // universal.
      { name: "theme-color", content: "#05130a" },
      { title: "Safralume: o preço da sua saca e o do porto, direto no WhatsApp" },
      {
        name: "description",
        content:
          "Safralume traduz relatórios oficiais (Conab e órgãos estaduais) em respostas simples, para grãos e pecuária: o preço da sua região, a comparação com o porto e o frete, direto no WhatsApp do produtor.",
      },
      {
        property: "og:title",
        content: "Safralume: o preço da sua saca e o do porto, direto no WhatsApp",
      },
      {
        property: "og:description",
        content: "O preço da sua saca e o do porto, direto no WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:url", content: "https://www.safralume.com.br" },
      { property: "og:site_name", content: "Safralume" },
      { property: "og:image", content: "https://www.safralume.com.br/images/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Safralume: o preço da sua saca e o do porto, direto no WhatsApp",
      },
      {
        name: "twitter:description",
        content: "O preço da sua saca e o do porto, direto no WhatsApp.",
      },
      { name: "twitter:image", content: "https://www.safralume.com.br/images/og-image.jpg" },
    ],
    links: [
      // Pixel da Meta: o PageView só sai quando o fbevents.js executa, e é ele
      // que vira "visualização da página" no relatório dos anúncios. Conectar e
      // baixar o script já no começo encurta o tempo até esse evento (medido:
      // celular médio em 4G só mandava o PageView depois de ~6s).
      { rel: "preconnect", href: "https://connect.facebook.net" },
      { rel: "preconnect", href: "https://www.facebook.com" },
      { rel: "preload", as: "script", href: "https://connect.facebook.net/en_US/fbevents.js" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: matches.some((m) => m.routeId.startsWith("/dashboard"))
          ? FONTES_PAINEL_URL
          : FONTES_CRITICAS_URL,
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "canonical", href: "https://www.safralume.com.br" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Safralume",
          url: "https://www.safralume.com.br",
          logo: "https://www.safralume.com.br/favicon.png",
          description:
            "Assistente via WhatsApp que traduz preços agrícolas oficiais (Conab e órgãos estaduais) em respostas com o preço da região, a comparação com o porto e o frete.",
        }),
      },
      {
        type: "application/ld+json",
        // Preço real, extraído do mesmo pricingPlans que a seção de Preços
        // da landing usa — nunca inventar/duplicar o número aqui, senão os
        // dois lugares divergem no dia em que um plano mudar de preço.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Safralume",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, WhatsApp",
          url: "https://www.safralume.com.br",
          description:
            "Assistente via WhatsApp e painel web que traduz preços agrícolas oficiais em respostas com o preço da região, a comparação com o porto e o frete, para produtores rurais e cooperativas.",
          offers: pricingPlans.map((plano) => ({
            "@type": "Offer",
            name: `Plano ${plano.name}`,
            price: plano.price.toString(),
            priceCurrency: "BRL",
            description: plano.audience,
            url: "https://www.safralume.com.br/#planos",
          })),
        }),
      },
      // Meta Pixel base — dataset "Safralume Site" (ID 1610112627458029),
      // criado direto dentro da conta de anúncios "Safralume" pra evitar o
      // problema do pixel "Safralume" antigo (1241007721486432) nunca ter
      // sincronizado como ativo conectado dessa conta — mesmo pertencendo
      // ao mesmo Business Manager, a conta nova não o enxergava no seletor
      // de evento de conversão da campanha. PageView automático em toda
      // rota; a conversão de verdade (CompleteRegistration) é disparada
      // manualmente em onboarding.tsx quando o cadastro é concluído, ver
      // metaPixel.ts.
      {
        children: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
if(!/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)){fbq('init', '1610112627458029');
fbq('track', 'PageView');}`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1610112627458029&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    capturarOrigem();
  }, []);

  const noPainel = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId.startsWith("/dashboard")),
  });
  useEffect(() => {
    const urls = noPainel
      ? [FONTES_CRITICAS_URL, FONTES_MONO_URL]
      : [FONTES_MONO_LANDING_URL, FONTES_DESTAQUE_URL];
    const carregar = () => {
      for (const href of urls) {
        if (document.querySelector(`link[href="${href}"]`)) continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(carregar, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [noPainel]);

  return (
    // reducedMotion="user": toda animação de transform/layout (x, y, scale,
    // top, left...) de qualquer motion.* do site respeita
    // prefers-reduced-motion automaticamente, sem precisar repetir a checagem
    // em cada componente — achado da auditoria de performance 2026-10-09:
    // as animações novas desta sessão (blobs do login, stagger do painel,
    // parallax) não respeitavam isso. Não cobre clipPath/pathLength/mouse
    // tracking (não são "positional keys" do framer-motion) — esses ficam
    // com checagem manual onde existem (Hero, login).
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
          <CookieConsent />
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}
