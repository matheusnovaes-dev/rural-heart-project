import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { MenuTelaCheia } from "@/components/landing/MenuTelaCheia";
import { siteConfig, buildWhatsAppLink } from "@/config/site";
import { trackLanding } from "@/lib/metaPixel";
import { MIDIA } from "@/assets/midia";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 py-2">
          <img src={MIDIA.logo} alt="" className="size-8 rounded-[0.6rem]" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            {siteConfig.name}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            data-rolar
            className="hidden px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline"
          >
            Entrar
          </Link>
          <Button
            asChild
            size="sm"
            className="hidden bg-cta text-cta-foreground hover:bg-cta/90 md:inline-flex"
          >
            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              data-magnetico
              data-rolar
              onClick={() => trackLanding("WhatsappClique", { origem: "header" })}
            >
              Falar no WhatsApp
            </a>
          </Button>
          <MenuTelaCheia />
        </div>
      </div>
    </header>
  );
}
