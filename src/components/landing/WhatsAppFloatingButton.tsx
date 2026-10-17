import { useEffect, useState } from "react";
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
  // Perto do formulário final e do rodapé o botão sai de cena (cobria o texto legal e a faixa de fontes; ali já há
  // um CTA de WhatsApp). Um observador de interseção, sem ouvir a rolagem.
  const [noFim, setNoFim] = useState(false);
  useEffect(() => {
    const alvos = ["comece", "rodape"]
      .map((id) => document.getElementById(id))
      .concat(Array.from(document.querySelectorAll("footer")))
      .filter((x): x is HTMLElement => !!x);
    if (!alvos.length) return;
    const dentro = new Set<Element>();
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) e.isIntersecting ? dentro.add(e.target) : dentro.delete(e.target);
      setNoFim(dentro.size > 0);
    });
    alvos.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, []);
  return (
    <div role="region" aria-label="Contato rápido pelo WhatsApp">
      <a
        href={buildWhatsAppLink(siteConfig.whatsapp.supportMessage)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Tirar dúvidas no WhatsApp"
        onClick={() => trackLanding("WhatsappClique", { origem: "botao_flutuante" })}
        className={cn(
          "fixed right-4 bottom-[calc(1rem+var(--cookie-h,0px))] z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-[transform,opacity] hover:scale-105 sm:right-6 sm:bottom-6",
          (barraFixaVisivel || heroEmTela) && "max-sm:hidden",
          noFim && "pointer-events-none opacity-0",
        )}
      >
        <MessageCircle className="size-6" aria-hidden="true" />
      </a>
    </div>
  );
}
