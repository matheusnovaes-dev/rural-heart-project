/**
 * Indicadores do Imea (boletim semanal de Mato Grosso) que estavam no banco e só o painel lia:
 * escala de abate, vaca gorda, boi a prazo, diferencial MT-SP, prêmio no porto de Santos,
 * diferencial de base, indicadores do Cepea que o Imea republica e o caroço de algodão.
 * Achado 2026-10-15 (auditoria "estamos lendo tudo?"). São dados de MT: a resposta tem que dizer isso.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarCultura } from "@/config/culturas";

type CadeiaImea = "boi" | "soja" | "milho" | "algodao";

// Só indicadores que são "fotografia de hoje" (preço, prêmio, base, escala); contratos futuros ficam
// de fora (já há a ferramenta de mercado futuro).
const INDICADORES: Record<CadeiaImea, string[]> = {
  boi: ["Boi gordo a prazo", "Vaca gorda a prazo", "Escala de abate", "DB MT-SP"],
  soja: [
    "Soja Disponível",
    "Cepea",
    "Prêmio portuário - Santos",
    "Diferencial de base (MT-CME-Group)",
  ],
  milho: [
    "Milho Disponível",
    "Cepea- Campinas",
    "Prêmio portuário - Santos",
    "Diferencial de base (MT-CME-Group)",
  ],
  algodao: ["Preço Imea Pluma-MT", "Indicador Cepea/Esalq", "Caroço disponível"],
};

const ROTULO: Record<string, string> = {
  "Boi gordo a prazo": "Boi gordo a prazo (MT)",
  "Vaca gorda a prazo": "Vaca gorda a prazo (MT)",
  "Escala de abate": "Escala de abate dos frigoríficos (MT)",
  "DB MT-SP": "Diferença do boi de MT para SP",
  "Soja Disponível": "Soja disponível (MT)",
  Cepea: "Indicador Cepea da soja",
  "Cepea- Campinas": "Indicador Cepea do milho (Campinas)",
  "Milho Disponível": "Milho disponível (MT)",
  "Prêmio portuário - Santos": "Prêmio no porto de Santos",
  "Diferencial de base (MT-CME-Group)": "Diferencial de base de MT contra a bolsa de Chicago",
  "Preço Imea Pluma-MT": "Algodão em pluma (MT)",
  "Indicador Cepea/Esalq": "Indicador Cepea do algodão",
  "Caroço disponível": "Caroço de algodão (MT)",
};

export type IndicadorImea = {
  indicador: string;
  rotulo: string;
  valor: number;
  unidade: string;
  local: string;
  data_referencia: string;
};

export type ResultadoIndicadoresImea = {
  encontrado: boolean;
  cadeia?: CadeiaImea;
  fonte: "Imea (boletim semanal de Mato Grosso)";
  indicadores?: IndicadorImea[];
  nota?: string;
};

export function cadeiaDoImea(cultura: string): CadeiaImea | null {
  const c = normalizarCultura(cultura);
  if (c === "boi") return "boi";
  if (c === "soja") return "soja";
  if (c === "milho") return "milho";
  if (c.startsWith("algod") || c.includes("caroço")) return "algodao";
  return null;
}

export async function buscarIndicadoresImea(
  supabase: SupabaseClient,
  args: { cultura: string | null },
): Promise<ResultadoIndicadoresImea> {
  const fonte = "Imea (boletim semanal de Mato Grosso)" as const;
  const cadeia = args.cultura ? cadeiaDoImea(args.cultura) : null;
  if (!cadeia) {
    return {
      encontrado: false,
      fonte,
      nota: "O Imea publica indicadores de boi, soja, milho e algodão de Mato Grosso. Não há dado dessa cultura.",
    };
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("imea_indicadores")
    .select("indicador, local, unidade, valor, data_referencia")
    .eq("cadeia", cadeia)
    .in("indicador", INDICADORES[cadeia])
    .eq("periodicidade", cadeia === "algodao" ? "semanal" : "diario")
    .lte("data_referencia", hoje)
    .order("data_referencia", { ascending: false })
    .limit(400);
  // Algodão traz o caroço semanal e os preços diários: busca os diários à parte.
  const diarios =
    cadeia === "algodao"
      ? await supabase
          .from("imea_indicadores")
          .select("indicador, local, unidade, valor, data_referencia")
          .eq("cadeia", cadeia)
          .in("indicador", ["Preço Imea Pluma-MT", "Indicador Cepea/Esalq"])
          .eq("periodicidade", "diario")
          .lte("data_referencia", hoje)
          .order("data_referencia", { ascending: false })
          .limit(100)
      : { data: [] as typeof data };

  const linhas = [...(data ?? []), ...(diarios.data ?? [])] as {
    indicador: string;
    local: string;
    unidade: string;
    valor: number;
    data_referencia: string;
  }[];
  // O mais recente de cada indicador; no caroço (várias praças no mesmo dia) fica só o de MT.
  const maisRecente = new Map<string, IndicadorImea>();
  for (const l of linhas) {
    if (l.indicador === "Caroço disponível" && l.local !== "MT") continue;
    if (maisRecente.has(l.indicador)) continue;
    maisRecente.set(l.indicador, {
      indicador: l.indicador,
      rotulo: ROTULO[l.indicador] ?? l.indicador,
      valor: l.valor,
      unidade: l.unidade,
      local: l.local,
      data_referencia: l.data_referencia,
    });
  }
  const indicadores = INDICADORES[cadeia]
    .map((i) => maisRecente.get(i))
    .filter((i): i is IndicadorImea => !!i);
  if (indicadores.length === 0) return { encontrado: false, fonte, cadeia };
  return {
    encontrado: true,
    cadeia,
    fonte,
    indicadores,
    nota: "São dados de Mato Grosso (Imea), publicados no boletim semanal. Diga sempre que são de MT e cite a data de cada um.",
  };
}
