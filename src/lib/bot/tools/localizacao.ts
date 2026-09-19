import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarMunicipio } from "@/lib/clima";
import { ufs } from "@/config/ufs";
import type { ProdutorContexto } from "@/lib/bot/types";

/**
 * Guarda a cidade que o produtor disse ser a dele no cadastro (município +
 * coordenada), pra o frete usar a rota mais próxima dele nas próximas
 * respostas em vez de uma rota qualquer do estado. Antes disso o bot
 * respondia "minha cidade é X" só recalculando aquela mensagem e esquecendo
 * — o cadastro continuava sem cidade.
 *
 * Atualiza também o `produtor` em memória: o resto do turno (ex: o
 * buscar_preco logo depois) já enxerga a coordenada nova.
 */
export async function atualizarLocalizacao(
  supabase: SupabaseClient,
  args: { municipio: string; uf: string },
  ctx: { produtor: ProdutorContexto },
) {
  if (!ctx.produtor.id) return { sucesso: false, motivo: "sem_cadastro" };

  const nomeCompletoUf = ufs.find((u) => u.value === args.uf.toUpperCase())?.label;
  if (!nomeCompletoUf) return { sucesso: false, motivo: "uf_invalida" };

  const municipio = await buscarMunicipio(args.municipio.trim(), nomeCompletoUf);
  if (!municipio) return { sucesso: false, motivo: "cidade_nao_encontrada" };

  const { error } = await supabase
    .from("produtores")
    .update({ municipio: municipio.nome, lat: municipio.lat, lon: municipio.lon })
    .eq("id", ctx.produtor.id);
  if (error) return { sucesso: false, motivo: "erro_ao_salvar" };

  ctx.produtor.municipio = municipio.nome;
  ctx.produtor.lat = municipio.lat;
  ctx.produtor.lon = municipio.lon;
  return { sucesso: true, municipio: municipio.nome, uf: args.uf.toUpperCase() };
}
