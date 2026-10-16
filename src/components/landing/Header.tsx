import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig, buildWhatsAppLink } from "@/config/site";
import { trackLanding } from "@/lib/metaPixel";

const navLinks = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Preços" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 py-2">
          <img src="/logo-icon.png" alt="" className="size-8 rounded-[0.6rem]" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            {siteConfig.name}
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Entrar
          </Link>
          <Button asChild size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              data-magnetico
              onClick={() => trackLanding("WhatsappClique", { origem: "header" })}
            >
              Falar no WhatsApp
            </a>
          </Button>
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(20rem,85vw)]">
            <SheetTitle className="flex items-center gap-2">
              <img src="/logo-icon.png" alt="" className="size-7 rounded-[0.55rem]" />
              {siteConfig.name}
            </SheetTitle>
            <nav aria-label="Navegação mobile" className="mt-6 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  {link.label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                Entrar
              </Link>
              <Button asChild className="mt-3 bg-cta text-cta-foreground hover:bg-cta/90">
                <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                  Falar no WhatsApp
                </a>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
