import type { SupabaseClient } from "@supabase/supabase-js";

import { renderizarEstudo } from "@/lib/bot/estudoDeProposta";
import {
  aplicarAlteracao,
  explicarEstudo,
  referenciaInformadaPeloProdutor,
  type AlteracaoPedida,
} from "@/lib/bot/propostas/acompanhamento";
import { salvarEstudo } from "@/lib/bot/propostas/salvo";
import type { EstudoSalvo } from "@/lib/bot/propostas/tipos";

export const SEM_ESTUDO_RECENTE =
  "Não tenho um estudo seu recente aqui (eles ficam guardados por 6 horas). Manda de novo a foto da proposta, ou me conta o comprador e o preço, que eu faço o estudo na hora.";

type Ctx = {
  supabase: SupabaseClient;
  telefone: string;
  texto: string;
  estudoSalvo: EstudoSalvo | null;
};

/** "Por que está abaixo?", "de onde vem esse preço?": explica a conta do estudo guardado, por código. */
export function explicarEstudoFerramenta(ctx: Ctx) {
  if (!ctx.estudoSalvo) return { encontrado: true as const, resposta_pronta: SEM_ESTUDO_RECENTE };
  return { encontrado: true as const, resposta_pronta: explicarEstudo(ctx.estudoSalvo, ctx.texto) };
}

const limpa = (v: unknown) =>
  typeof v === "string" && ["null", "none", ""].includes(v.trim().toLowerCase()) ? null : v;

/** "E se a Cargill topar 130?", "à vista", "meu dinheiro rende 1,5%": refaz o estudo guardado com o valor novo. */
export async function refazerEstudoFerramenta(args: Partial<AlteracaoPedida>, ctx: Ctx) {
  if (!ctx.estudoSalvo) return { encontrado: true as const, resposta_pronta: SEM_ESTUDO_RECENTE };
  const alteracao: AlteracaoPedida = {
    comprador: (limpa(args.comprador) as string | null) ?? null,
    preco: args.preco ?? null,
    prazo_dias: args.prazo_dias ?? null,
    a_vista: args.a_vista ?? null,
    frete: (limpa(args.frete) as AlteracaoPedida["frete"]) ?? null,
    quantidade_sacas: args.quantidade_sacas ?? null,
    taxa_mensal_pct: args.taxa_mensal_pct ?? null,
    referencia_manual: args.referencia_manual ?? null,
    nova_proposta: args.nova_proposta ?? null,
  };
  // "Aqui o mercado paga 142": é a referência, não o preço de um comprador (o modelo trocava as duas).
  const referencia = referenciaInformadaPeloProdutor(ctx.texto, ctx.estudoSalvo);
  const final: AlteracaoPedida =
    referencia != null
      ? {
          comprador: null,
          preco: null,
          prazo_dias: null,
          a_vista: null,
          frete: null,
          quantidade_sacas: null,
          taxa_mensal_pct: null,
          referencia_manual: referencia,
          nova_proposta: null,
        }
      : alteracao;
  const r = aplicarAlteracao(ctx.estudoSalvo, final, ctx.texto);
  if (!r.ok) return { encontrado: true as const, resposta_pronta: r.mensagem };
  await salvarEstudo(ctx.supabase, ctx.telefone, r.estudo);
  return {
    encontrado: true as const,
    resposta_pronta: renderizarEstudo(r.estudo, { mudancas: r.mudancas }),
  };
}
