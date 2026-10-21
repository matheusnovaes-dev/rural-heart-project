import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { precoDeHoje } from "@/lib/bot/tools/fazendaBase";
import { produtividadeConab } from "@/lib/bot/tools/fazendaCusto";
import { supabaseServiceRole } from "@/lib/supabase.server";

const schema = z.object({
  cultura: z.string().min(1).max(40),
  uf: z.string().length(2).nullable(),
});

export type DadosDeMercadoDaCultura = {
  preco: { preco: number; uf: string } | null;
  conab: { scHa: number; safra: string } | null;
};

// Dado público de mercado (preço de hoje e média da Conab): muda 1 vez por dia, então vale guardar um pouco.
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { em: number; dados: DadosDeMercadoDaCultura }>();

/**
 * Preço de hoje e produtividade média da Conab da cultura no estado, para o cartão "Custo e margem" do caderno.
 * Só devolve números públicos já agregados (nada do produtor), por isso não exige login.
 */
export const dadosDeMercadoDaCultura = createServerFn({ method: "POST" })
  .validator(schema)
  .handler(async ({ data }): Promise<DadosDeMercadoDaCultura> => {
    const chave = `${data.cultura.toLowerCase()}|${data.uf ?? ""}`;
    const guardado = cache.get(chave);
    if (guardado && Date.now() - guardado.em < TTL_MS) return guardado.dados;
    const supabase = supabaseServiceRole();
    const [preco, conab] = await Promise.all([
      precoDeHoje(
        supabase,
        {
          id: null,
          nome: "",
          uf: data.uf,
          cultura_principal: null,
          municipio: null,
          lat: null,
          lon: null,
          user_id: null,
        },
        data.cultura,
      ).catch(() => null),
      produtividadeConab(supabase, data.cultura, data.uf).catch(() => null),
    ]);
    const dados = { preco, conab };
    cache.set(chave, { em: Date.now(), dados });
    return dados;
  });
