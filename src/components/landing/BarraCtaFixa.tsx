import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { useCadastro } from "@/components/landing/CadastroProvider";
import { buildWhatsAppLink, siteConfig } from "@/config/site";

/**
 * Barra de CTA fixa, só no celular (94% do tráfego da landing). O hero já tem
 * o campo de WhatsApp; depois que ele sai da tela esta barra mantém o caminho
 * pra converter sempre a um toque, em vez de exigir rolar de volta ao topo ou
 * ao rodapé. Some quando o formulário do rodapé ou o rodapé estão na tela
 * (senão cobriria o que a pessoa já está vendo) e o WhatsApp vira o ícone
 * ao lado, no lugar do botão flutuante.
 */
export function BarraCtaFixa() {
  const {
    abrirCadastro,
    barraFixaVisivel,
    setBarraFixaVisivel,
    heroEmTela,
    setHeroEmTela,
    ctaInlineVisivel,
  } = useCadastro();
  const reduzMovimento = useReducedMotion();
  const [fimEmTela, setFimEmTela] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cadastro");
    const final = document.getElementById("comece");
    const rodape = document.querySelector("footer");
    if (!hero) return;

    const emTela = new Map<Element, boolean>();
    const alvos: Element[] = [hero];
    if (final) alvos.push(final);
    if (rodape) alvos.push(rodape);
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) emTela.set(e.target, e.isIntersecting);
      setHeroEmTela(emTela.get(hero) ?? true);
      setFimEmTela(
        (final ? emTela.get(final) : false) === true ||
          (rodape ? emTela.get(rodape) : false) === true,
      );
    });
    alvos.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      setHeroEmTela(true);
    };
  }, [setHeroEmTela]);

  const visivel = !heroEmTela && !fimEmTela && !ctaInlineVisivel;
  useEffect(() => {
    setBarraFixaVisivel(visivel);
    return () => setBarraFixaVisivel(false);
  }, [visivel, setBarraFixaVisivel]);

  return (
    <AnimatePresence>
      {barraFixaVisivel && (
        <motion.div
          role="region"
          aria-label="Começar o teste grátis"
          initial={reduzMovimento ? { opacity: 0 } : { y: "110%" }}
          animate={reduzMovimento ? { opacity: 1 } : { y: 0 }}
          exit={reduzMovimento ? { opacity: 0 } : { y: "110%" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            bottom: "var(--cookie-h, 0px)",
            paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))",
          }}
          className="fixed inset-x-0 z-40 flex items-center gap-2.5 border-t border-border bg-background/95 px-3 pt-2.5 shadow-[0_-8px_24px_-12px_oklch(0.25_0.03_156/0.25)] backdrop-blur-md sm:hidden"
        >
          <button
            type="button"
            onClick={() => abrirCadastro()}
            className="h-12 min-w-0 flex-1 touch-manipulation rounded-xl bg-cta px-4 text-base font-bold whitespace-nowrap text-cta-foreground shadow-md shadow-cta/25 transition-[transform,background-color] hover:bg-cta/90 focus-visible:ring-4 focus-visible:ring-cta/40 focus-visible:outline-none active:scale-[0.98]"
          >
            Testar grátis por 7 dias
          </button>
          <a
            href={buildWhatsAppLink(siteConfig.whatsapp.supportMessage)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Tirar dúvidas no WhatsApp"
            className="flex size-12 shrink-0 touch-manipulation items-center justify-center rounded-xl bg-[#128C7E] text-white transition-[transform,background-color] hover:bg-[#0f7a6e] focus-visible:ring-4 focus-visible:ring-[#128C7E]/40 focus-visible:outline-none active:scale-[0.98]"
          >
            <MessageCircle className="size-6" aria-hidden="true" />
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
