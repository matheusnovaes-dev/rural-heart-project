import type { SupabaseClient } from "@supabase/supabase-js";

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
 */
export async function buscarLeiloesProximos(supabase: SupabaseClient, args: { uf: string | null }) {
  const { data } = await supabase
    .from("leiloes_agendados")
    .select("titulo, data_hora, municipio, uf, leiloeira")
    .gte("data_hora", new Date().toISOString())
    .order("data_hora", { ascending: true })
    .limit(200)
    .returns<LinhaLeilao[]>();

  if (!data || data.length === 0) return { encontrado: false };

  const ehVirtual = (l: LinhaLeilao) => (l.municipio ?? "").toUpperCase().startsWith("VIRTUAL");

  const presenciais = args.uf
    ? data
        .filter((l) => l.uf === args.uf && !ehVirtual(l))
        .slice(0, LIMITE_PRESENCIAIS)
        .map((l) => ({
          titulo: l.titulo,
          data_hora: l.data_hora,
          local: l.municipio,
          leiloeira: l.leiloeira,
        }))
    : [];

  const virtuais = data
    .filter(ehVirtual)
    .slice(0, LIMITE_VIRTUAIS)
    .map((l) => ({ titulo: l.titulo, data_hora: l.data_hora, leiloeira: l.leiloeira }));

  if (presenciais.length === 0 && virtuais.length === 0) return { encontrado: false };

  return { encontrado: true, presenciais_na_regiao: presenciais, virtuais_em_destaque: virtuais };
}
