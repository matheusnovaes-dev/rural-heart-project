import type { SupabaseClient } from "@supabase/supabase-js";

/** Culturas com Tábua de Risco do ZARC (zoneamento anual de plantio). Café e
 * cana são perenes (sem janela anual) e boi é pecuária — nenhum dos dois tem
 * linha nessa tabela, de propósito. */
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

export type JanelaPlantio = { periodo: string; risco_climatico_pct: number | null };

export type ResultadoJanelaPlantio =
  | {
      disponivel: false;
      motivo: "cultura_nao_coberta" | "municipio_ausente" | "municipio_nao_encontrado";
    }
  | {
      disponivel: true;
      fonte: string;
      periodo_atual: string;
      risco_climatico_hoje_pct: number | null;
      proximas_janelas: JanelaPlantio[];
    };

export async function consultarJanelaPlantio(
  supabase: SupabaseClient,
  args: { produto: string; uf: string; municipio: string | null },
): Promise<ResultadoJanelaPlantio> {
  const cultura = args.produto.toUpperCase();
  if (!CULTURAS_COBERTAS.includes(cultura)) {
    return { disponivel: false, motivo: "cultura_nao_coberta" };
  }
  if (!args.municipio) {
    return { disponivel: false, motivo: "municipio_ausente" };
  }

  // RPC em vez de .ilike() direto: o município do produtor vem de geocodificação
  // de terceiros e às vezes chega sem acento (ex: "Pompeu"), enquanto o ZARC usa
  // o nome oficial do IBGE (ex: "Pompéu") — ILIKE puro não ignora acento, então
  // dado que existia de verdade aparecia como "não encontrado". A função
  // buscar_zarc_janela (ver supabase/migrations) usa unaccent() nos dois lados.
  // Sem .returns<>() aqui: o client de tipos gerados não conhece essa RPC
  // (não existe nos types gerados do Supabase), e o generic entra em conflito
  // com a heurística de "single object" dele — cast direto no valor.
  const { data } = await supabase.rpc("buscar_zarc_janela", {
    p_cultura: cultura,
    p_uf: args.uf,
    p_municipio: args.municipio,
  });

  const linhas = (data ?? []) as LinhaZarc[];
  if (linhas.length === 0) {
    return { disponivel: false, motivo: "municipio_nao_encontrado" };
  }

  const hoje = new Date();
  const indiceHoje = decendioDe(hoje);

  const proximasJanelas: JanelaPlantio[] = [];
  for (let i = indiceHoje; i < indiceHoje + 6 && i <= 36; i++) {
    proximasJanelas.push({
      periodo: labelDecendio(i),
      risco_climatico_pct: melhorRiscoNoDecendio(linhas, i),
    });
  }

  return {
    disponivel: true,
    fonte:
      "ZARC/MAPA — Zoneamento Agrícola de Risco Climático, Tábua de Risco oficial da safra vigente",
    periodo_atual: labelDecendio(indiceHoje),
    risco_climatico_hoje_pct: melhorRiscoNoDecendio(linhas, indiceHoje),
    proximas_janelas: proximasJanelas,
  };
}

/** Mapeia cultura_principal do produtor (catálogo de src/config/culturas.ts)
 * pro rótulo que o ZARC usa. Algodão em pluma e em caroço caem no mesmo
 * "ALGODÃO" (a Tábua de Risco não separa por destino da fibra). Retorna null
 * pra qualquer cultura sem zoneamento anual (perene, pecuária, ou fora do
 * catálogo de 5 culturas do ZARC) — quem chama deve simplesmente não mostrar
 * o widget nesse caso, nunca inventar uma janela pra cultura que não tem.
 */
export function culturaParaZarc(cultura: string | null | undefined): string | null {
  if (!cultura) return null;
  const c = cultura.trim().toLowerCase();
  if (c.startsWith("algodão")) return "ALGODÃO";
  if (c === "soja" || c === "milho" || c === "arroz" || c === "feijão") return c.toUpperCase();
  return null;
}
