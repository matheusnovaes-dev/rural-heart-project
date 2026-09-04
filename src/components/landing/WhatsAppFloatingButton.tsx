import { MessageCircle } from "lucide-react";

import { buildWhatsAppLink, siteConfig } from "@/config/site";

/**
 * Bolha fixa pra quem só quer tirar uma dúvida rápida com um humano — o
 * formulário de teste grátis e os botões de plano são pra quem já decidiu,
 * isso aqui é pra quem ainda tá em dúvida e não quer preencher nada.
 */
export function WhatsAppFloatingButton() {
  return (
    <div role="region" aria-label="Contato rápido pelo WhatsApp">
      <a
        href={buildWhatsAppLink(siteConfig.whatsapp.supportMessage)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Tirar dúvidas no WhatsApp"
        className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
      >
        <MessageCircle className="size-6" />
      </a>
    </div>
  );
}
