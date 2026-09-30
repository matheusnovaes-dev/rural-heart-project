import type { SupabaseClient } from "@supabase/supabase-js";

type LinhaFerrugem = {
  safra: string;
  safra_id: number;
  municipio_nome: string;
  tipo: number;
  quantidade: number;
};

/**
 * Ocorrências de ferrugem asiática da soja por município, na safra mais
 * recente com dado pra essa UF — fonte Consórcio Antiferrugem, achada
 * 2026-09-30 (ver ingest-ferrugem-asiatica.mjs no conab-ingestor). tipo 1 =
 * ocorrência confirmada, 4 = presença de esporos (alerta precoce, antes de
 * sintoma visível na lavoura) — só esses dois importam pro produtor decidir
 * se aumenta vigilância; tipo 3 (soja voluntária) e 5 (unidade de alerta,
 * não é detecção) ficam de fora da resposta.
 */
export async function buscarFerrugemAsiatica(supabase: SupabaseClient, args: { uf: string }) {
  const { data } = await supabase
    .from("ferrugem_asiatica_ocorrencias")
    .select("safra, safra_id, municipio_nome, tipo, quantidade")
    .eq("uf", args.uf)
    .order("safra_id", { ascending: false })
    .returns<LinhaFerrugem[]>();

  if (!data || data.length === 0) return { encontrado: false };

  const safraMaisRecente = data[0]!.safra_id;
  const daSafra = data.filter((l) => l.safra_id === safraMaisRecente);

  const confirmadas = daSafra
    .filter((l) => l.tipo === 1 && l.quantidade > 0)
    .map((l) => ({ municipio: l.municipio_nome, ocorrencias: l.quantidade }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias);

  const esporos = daSafra
    .filter((l) => l.tipo === 4 && l.quantidade > 0)
    .map((l) => ({ municipio: l.municipio_nome }));

  return {
    encontrado: true,
    safra: daSafra[0]!.safra,
    municipios_com_ocorrencia_confirmada: confirmadas,
    municipios_com_esporos_no_ar: esporos,
  };
}
