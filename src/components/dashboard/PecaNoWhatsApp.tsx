import { SafralumeIcon } from "@/components/icons/SafralumeIcon";

import { normalizarCultura } from "@/config/culturas";
import { buildWhatsAppLink } from "@/config/site";
import { trackLanding } from "@/lib/metaPixel";

type Atalho = { rotulo: string; texto: string };

/**
 * Atalhos de "o que mais dá pra pedir", escolhidos pela cultura e pelo estado do produtor. Cada um abre
 * o WhatsApp com a pergunta já escrita. Pedido do Matheus (2026-10-15): o produtor precisa ver a
 * variedade do que o Safralume faz, no que fizer sentido para ele, e não só o preço.
 */
export function atalhosDoProdutor(cultura: string | null, uf: string | null): Atalho[] {
  const c = cultura ? normalizarCultura(cultura) : null;
  const nome = c ?? "minha cultura";
  const grao = !!c && ["soja", "milho", "trigo", "feijão", "arroz", "sorgo granífero"].includes(c);
  const boi =
    !!c && ["boi", "bezerro", "garrote", "novilha", "vaca gorda", "vaca magra"].includes(c);
  const mt = uf?.toUpperCase() === "MT";
  const lista: Atalho[] = [
    { rotulo: "Vale vender agora?", texto: `Vale vender ${nome} agora?` },
    { rotulo: "Resumo de bom dia", texto: "Quero o resumo diário às 7h" },
    {
      rotulo: "Comparar uma proposta",
      texto: "Quero comparar uma proposta de comprador com o mercado",
    },
  ];
  if (c === "soja")
    lista.push({ rotulo: "Ferrugem na região", texto: "Tem foco de ferrugem na minha região?" });
  if (grao)
    lista.push({ rotulo: "Janela de plantio", texto: `Qual a janela de plantio de ${nome}?` });
  if (boi) {
    lista.push({ rotulo: "Leilões de gado", texto: "Tem leilão de gado essa semana?" });
    lista.push({ rotulo: "Bezerro e vaca magra", texto: "Quanto tá o bezerro?" });
  }
  if (mt && (boi || grao)) {
    lista.push({ rotulo: "Mercado de MT (Imea)", texto: "Como está a escala de abate em MT?" });
  }
  lista.push(
    { rotulo: "Clima e geada", texto: "Como está o clima nos próximos dias na minha região?" },
    { rotulo: "Quanto vale a safra", texto: `Quanto vale a minha safra de ${nome}?` },
    { rotulo: "Dólar e futuros", texto: "Como estão o dólar e os futuros da B3?" },
    { rotulo: "Outra cultura ou estado", texto: "Quanto tá o café em MG?" },
  );
  return lista.slice(0, 8);
}

export function PecaNoWhatsApp({ cultura, uf }: { cultura: string | null; uf: string | null }) {
  const atalhos = atalhosDoProdutor(cultura, uf);
  return (
    <section
      aria-labelledby="peca-no-whatsapp"
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start gap-3">
        <SafralumeIcon nome="whatsapp" className="size-9 shrink-0" />
        <div>
          <h2 id="peca-no-whatsapp" className="text-base font-semibold text-foreground">
            O que mais você pode pedir no WhatsApp
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Toque e o WhatsApp abre com a pergunta já escrita. Dá pra mandar texto ou áudio.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {atalhos.map((a) => (
          <a
            key={a.rotulo}
            href={buildWhatsAppLink(a.texto)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLanding("AtalhoWhatsappPainel", { atalho: a.rotulo })}
            className="inline-flex min-h-9 items-center rounded-full border border-border bg-secondary/60 px-3.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-secondary pointer-coarse:min-h-11"
          >
            {a.rotulo}
          </a>
        ))}
      </div>
    </section>
  );
}
