import { Sprout } from "lucide-react";

import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sprout className="size-3.5" />
          </span>
          <span className="font-semibold text-foreground">{siteConfig.name}</span>
        </div>

        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {siteConfig.name} apresenta cenários de mercado agrícola com base em dados públicos do
          Cepea e da Conab. As informações têm caráter informativo e não constituem recomendação de
          investimento, consultoria financeira ou garantia de preço futuro.
        </p>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
