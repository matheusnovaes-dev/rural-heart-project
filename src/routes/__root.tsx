import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth";
import { Toaster } from "../components/ui/sonner";
import { pricingPlans } from "../config/site";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Safralume: preço líquido da sua saca, direto no WhatsApp" },
      {
        name: "description",
        content:
          "Safralume traduz relatórios oficiais (Conab e órgãos estaduais) em respostas simples, para grãos e pecuária, com frete já descontado, direto no WhatsApp do produtor.",
      },
      { property: "og:title", content: "Safralume: preço líquido da sua saca, direto no WhatsApp" },
      {
        property: "og:description",
        content: "O preço líquido da sua saca, direto no WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:url", content: "https://www.safralume.com.br" },
      { property: "og:site_name", content: "Safralume" },
      { property: "og:image", content: "/images/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Safralume: preço líquido da sua saca, direto no WhatsApp",
      },
      {
        name: "twitter:description",
        content: "O preço líquido da sua saca, direto no WhatsApp.",
      },
      { name: "twitter:image", content: "/images/og-image.jpg" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
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
            "Assistente via WhatsApp que traduz preços agrícolas oficiais (Conab e órgãos estaduais) em respostas com frete já descontado.",
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
            "Assistente via WhatsApp e painel web que traduz preços agrícolas oficiais em respostas com frete já descontado, para produtores rurais e cooperativas.",
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
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
