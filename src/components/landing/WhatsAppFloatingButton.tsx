import { MessageCircle } from "lucide-react";

import { useCadastro } from "@/components/landing/CadastroProvider";
import { buildWhatsAppLink, siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { trackLanding } from "@/lib/metaPixel";

/**
 * Bolha fixa pra quem só quer tirar uma dúvida rápida com um humano — o
 * formulário de teste grátis e os botões de plano são pra quem já decidiu,
 * isso aqui é pra quem ainda tá em dúvida e não quer preencher nada.
 */
export function WhatsAppFloatingButton() {
  // No celular o botão flutuante sai de cena quando atrapalharia: sobre o hero
  // (cobria o texto abaixo do campo) e com a barra de CTA fixa na tela (o
  // WhatsApp já aparece como ícone dentro dela).
  const { barraFixaVisivel, heroEmTela } = useCadastro();
  return (
    <div role="region" aria-label="Contato rápido pelo WhatsApp">
      <a
        href={buildWhatsAppLink(siteConfig.whatsapp.supportMessage)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Tirar dúvidas no WhatsApp"
        onClick={() => trackLanding("WhatsappClique", { origem: "botao_flutuante" })}
        className={cn(
          "fixed right-4 bottom-[calc(1rem+var(--cookie-h,0px))] z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 sm:right-6 sm:bottom-6",
          (barraFixaVisivel || heroEmTela) && "max-sm:hidden",
        )}
      >
        <MessageCircle className="size-6" aria-hidden="true" />
      </a>
    </div>
  );
}
