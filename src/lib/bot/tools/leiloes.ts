import type { SupabaseClient } from "@supabase/supabase-js";

import { temAcessoPrata, type Plano } from "@/lib/planos.shared";

type LinhaLeilao = {
  titulo: string;
  data_hora: string | null;
  municipio: string | null;
  uf: string | null;
  leiloeira: string | null;
};

const LIMITE_PRESENCIAIS = 5;
const LIMITE_VIRTUAIS = 5;

/**
 * Agenda de leilões de gado (genética/reprodutores, majoritariamente) —
 * fonte ArrobaPlay, achada e ingerida 2026-10-02 (ver ingest-leiloes.mjs no
 * conab-ingestor). Achado real conferindo os dados: leilão PRESENCIAL (ex:
 * fazenda em Alta Floresta/MT) tem local de verdade, mas leilão VIRTUAL
 * (maioria) mostra o ESTÚDIO de transmissão da leiloeira (quase sempre
 * Araçatuba/SP), não de onde vêm os lotes — filtrar por UF do produtor só
 * faz sentido pros presenciais; os virtuais são nacionais, qualquer um pode
 * assistir e dar lance de qualquer estado, então entram à parte, sem filtro
 * de UF.
 *
 * Exclusivo Prata+ (mesmo padrão de buscar_preco_insumo) — plano Bronze
 * recebe só disponivel_no_plano=false, pro prompt oferecer um gostinho
 * (teaser) sem dado real, nunca a contagem de verdade.
 */
export async function buscarLeiloesProximos(
  supabase: SupabaseClient,
  args: { uf: string | null },
  produtorId: string | null,
) {
  if (produtorId) {
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("plano")
      .eq("produtor_id", produtorId)
      .maybeSingle();
    const plano = (assinatura?.plano as Plano | undefined) ?? null;
    if (!temAcessoPrata(plano)) return { encontrado: false, disponivel_no_plano: false };
  }

  const { data } = await supabase
    .from("leiloes_agendados")
    .select("titulo, data_hora, municipio, uf, leiloeira")
    .gte("data_hora", new Date().toISOString())
    .order("data_hora", { ascending: true })
    .limit(200)
    .returns<LinhaLeilao[]>();

  if (!data || data.length === 0) return { encontrado: false };

  const ehVirtual = (l: LinhaLeilao) => (l.municipio ?? "").toUpperCase().startsWith("VIRTUAL");

  const todosPresenciais = args.uf ? data.filter((l) => l.uf === args.uf && !ehVirtual(l)) : [];
  const todosVirtuais = data.filter(ehVirtual);

  const presenciais = todosPresenciais.slice(0, LIMITE_PRESENCIAIS).map((l) => ({
    titulo: l.titulo,
    data_hora: l.data_hora,
    local: l.municipio,
    leiloeira: l.leiloeira,
  }));

  const virtuais = todosVirtuais
    .slice(0, LIMITE_VIRTUAIS)
    .map((l) => ({ titulo: l.titulo, data_hora: l.data_hora, leiloeira: l.leiloeira }));

  if (presenciais.length === 0 && virtuais.length === 0) return { encontrado: false };

  return {
    encontrado: true,
    total_presenciais_na_regiao: todosPresenciais.length,
    total_virtuais_em_destaque: todosVirtuais.length,
    presenciais_na_regiao: presenciais,
    virtuais_em_destaque: virtuais,
  };
}
