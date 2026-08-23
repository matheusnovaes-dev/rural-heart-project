import { Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig, buildWhatsAppLink } from "@/config/site";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#topo" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            {siteConfig.name}
          </span>
        </a>

        <Button asChild size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
          <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer">
            Falar no WhatsApp
          </a>
        </Button>
      </div>
    </header>
  );
}
