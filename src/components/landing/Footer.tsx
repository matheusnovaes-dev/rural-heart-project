import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

import { siteConfig, buildWhatsAppLink } from "@/config/site";

const links = [
  { to: "/privacidade" as const, label: "Privacidade" },
  { to: "/termos" as const, label: "Termos de uso" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sprout className="size-3.5" />
            </span>
            <span className="font-display font-semibold text-foreground">{siteConfig.name}</span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className="hover:text-foreground hover:underline">
                {link.label}
              </Link>
            ))}
            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              Contato
            </a>
          </nav>
        </div>

        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {siteConfig.name} apresenta cenários de mercado agrícola com base em dados públicos da
          Conab e da Imea. As informações têm caráter informativo e não constituem recomendação de
          investimento, consultoria financeira ou garantia de preço futuro.
        </p>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.name}. Todos os direitos reservados.
        </p>

        <p className="text-[10px] text-muted-foreground/60">
          CNPJ 68.802.997/0001-37 (68.802.997 MATHEUS NOVAES DE MOURA)
        </p>
      </div>
    </footer>
  );
}
