import type { SupabaseClient } from "@supabase/supabase-js";

const CULTURAS_COBERTAS = ["SOJA", "MILHO", "ALGODÃO", "ARROZ", "FEIJÃO"];

const NOMES_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Decêndio (1-36): 3 janelas de 10 dias por mês, convenção padrão do ZARC/MAPA. */
function decendioDe(data: Date): number {
  const mes = data.getMonth();
  const dia = data.getDate();
  const parte = dia <= 10 ? 1 : dia <= 20 ? 2 : 3;
  return mes * 3 + parte;
}

function labelDecendio(indice: number): string {
  const mes = Math.floor((indice - 1) / 3);
  const parte = ((indice - 1) % 3) + 1;
  const faixa = parte === 1 ? "dia 1 a 10" : parte === 2 ? "dia 11 a 20" : "dia 21 ao fim do mês";
  return `${faixa} de ${NOMES_MESES[mes]}`;
}

type LinhaZarc = { riscos_decendio: number[] };

/** Entre todas as variantes de cultivar/solo disponíveis pro município (o
 * produtor não escolheu isso ainda), pega o risco MAIS BAIXO real — a
 * melhor opção genuína, não a pior. 0 = não recomendado em nenhuma
 * variante nesse decêndio. */
function melhorRiscoNoDecendio(linhas: LinhaZarc[], indice: number): number | null {
  let melhor: number | null = null;
  for (const l of linhas) {
    const v = l.riscos_decendio[indice - 1] ?? 0;
    if (v > 0 && (melhor == null || v < melhor)) melhor = v;
  }
  return melhor;
}

export async function consultarJanelaPlantio(
  supabase: SupabaseClient,
  args: { produto: string; uf: string; municipio: string | null },
) {
  const cultura = args.produto.toUpperCase();
  if (!CULTURAS_COBERTAS.includes(cultura)) {
    return { disponivel: false, motivo: "cultura_nao_coberta" };
  }
  if (!args.municipio) {
    return { disponivel: false, motivo: "municipio_ausente" };
  }

  const { data } = await supabase
    .from("zarc_janelas_plantio")
    .select("riscos_decendio")
    .eq("cultura", cultura)
    .eq("uf", args.uf)
    .ilike("municipio", `%${args.municipio}%`)
    .limit(100)
    .returns<LinhaZarc[]>();

  const linhas = data ?? [];
  if (linhas.length === 0) {
    return { disponivel: false, motivo: "municipio_nao_encontrado" };
  }

  const hoje = new Date();
  const indiceHoje = decendioDe(hoje);

  const proximasJanelas = [];
  for (let i = indiceHoje; i < indiceHoje + 6 && i <= 36; i++) {
    proximasJanelas.push({
      periodo: labelDecendio(i),
      risco_climatico_pct: melhorRiscoNoDecendio(linhas, i),
    });
  }

  return {
    disponivel: true,
    fonte: "ZARC/MAPA — Zoneamento Agrícola de Risco Climático, Tábua de Risco oficial da safra vigente",
    periodo_atual: labelDecendio(indiceHoje),
    risco_climatico_hoje_pct: melhorRiscoNoDecendio(linhas, indiceHoje),
    proximas_janelas: proximasJanelas,
  };
}
