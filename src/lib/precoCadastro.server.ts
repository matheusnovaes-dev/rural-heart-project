import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { culturas, normalizarCultura } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { obterReferencia } from "@/lib/bot/propostas/referencia";
import { supabaseServiceRole } from "@/lib/supabase.server";

/**
 * Prévia do preço de hoje no cadastro: depois de escolher cultura e estado, a pessoa já vê o
 * número que vai receber (valor antes de pedir mais um dado). É o mesmo preço de referência que o
 * painel e o bot usam. Só devolve preço do PRÓPRIO estado (nada de média de outros estados: isso
 * já tem aviso próprio no formulário) e sempre com fonte e data.
 */
export type PreviaDePreco =
  { ok: true; titulo: string; valor: string; unidade: string; detalhe: string } | { ok: false };

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Cache curto em memória do Worker: o preço só muda uma vez por dia e o formulário pode ser
// aberto muitas vezes por quem chega de anúncio.
const cache = new Map<string, { em: number; v: PreviaDePreco }>();
const VALIDADE_MS = 10 * 60 * 1000;

export const buscarPreviaDePreco = createServerFn({ method: "GET" })
  .validator(z.object({ cultura: z.string().min(1).max(40), uf: z.string().length(2) }))
  .handler(async ({ data }): Promise<PreviaDePreco> => {
    const uf = data.uf.toUpperCase();
    const chave = normalizarCultura(data.cultura);
    const cultura = culturas.find((c) => c.value === chave || normalizarCultura(c.value) === chave);
    if (!cultura || !ufs.some((u) => u.value === uf)) return { ok: false };

    const k = `${chave}|${uf}`;
    const antigo = cache.get(k);
    if (antigo && Date.now() - antigo.em < VALIDADE_MS) return antigo.v;

    let v: PreviaDePreco = { ok: false };
    try {
      const r = await obterReferencia(supabaseServiceRole(), { produto: chave, uf });
      if (r.ok && !r.ref.aproximada) {
        const un =
          r.ref.unidade === "saca"
            ? `por saca de ${r.ref.kgPorSaca ?? 60} kg`
            : `por ${r.ref.unidade}`;
        const [a, m, d] = r.ref.data.slice(0, 10).split("-");
        // "hoje" só quando o dado é de hoje ou de ontem (fonte semanal, como a do PR, fica "último preço").
        const idadeDias =
          (Date.now() - new Date(`${r.ref.data.slice(0, 10)}T12:00:00-03:00`).getTime()) / 86400000;
        const recente = idadeDias <= 1.6;
        v = {
          ok: true,
          titulo: `${cultura.label} em ${uf}, ${recente ? "hoje" : "último preço"}`,
          valor: brl(r.ref.preco),
          unidade: un,
          detalhe: `${r.ref.rotulo}. Fonte: ${r.ref.fonte}, ${d}/${m}/${a}.`,
        };
      }
    } catch {
      v = { ok: false };
    }
    cache.set(k, { em: Date.now(), v });
    return v;
  });
