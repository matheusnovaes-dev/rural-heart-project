import {
  buscarPrevisao,
  buscarPrevisaoPorCoordenadas,
  buscarPrevisaoPorNomeDeCidade,
  type Previsao,
} from "@/lib/clima";
import { ufs } from "@/config/ufs";

export type ResultadoBuscarClima = {
  encontrado: boolean;
  local_usado?: string;
  fonte?: "cidade" | "coordenada_cadastrada" | "capital_estado";
  previsao?: Previsao;
  /** Dia da semana e "hoje/amanhã" de cada dia da previsão, calculados aqui (o modelo errava as duas contas). */
  calendario?: { data: string; dia_semana: string; quando: string | null }[];
};

const DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** Rótulo de cada dia da previsão, com a data de hoje em Brasília (o servidor roda em UTC). */
export function montarCalendario(
  dias: string[],
  agora: Date = new Date(),
): { data: string; dia_semana: string; quando: string | null }[] {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const base = Date.parse(`${hoje}T00:00:00Z`);
  return dias.map((data) => {
    const t = Date.parse(`${data.slice(0, 10)}T00:00:00Z`);
    const diff = Math.round((t - base) / 86400000);
    return {
      data,
      dia_semana: Number.isNaN(t) ? "" : DIAS[new Date(t).getUTCDay()]!,
      quando: diff === 0 ? "hoje" : diff === 1 ? "amanhã" : diff === 2 ? "depois de amanhã" : null,
    };
  });
}

export async function buscarClima(
  args: { uf: string; cidade: string | null },
  ctx: {
    produtor: {
      uf: string | null;
      lat: number | null;
      lon: number | null;
      municipio: string | null;
    };
  },
): Promise<ResultadoBuscarClima> {
  const { uf, cidade } = args;

  if (cidade) {
    const nomeCompletoUf = ufs.find((u) => u.value === uf)?.label;
    if (nomeCompletoUf) {
      const resultado = await buscarPrevisaoPorNomeDeCidade(cidade, uf, nomeCompletoUf);
      if (resultado) {
        return {
          encontrado: true,
          local_usado: resultado.nomeUsado,
          fonte: "cidade",
          previsao: resultado.previsao,
          calendario: montarCalendario(resultado.previsao.dias),
        };
      }
    }
  }

  // Coordenada cadastrada do produtor só vale se for da mesma UF da pergunta
  // — senão daria previsão da fazenda dele pra uma pergunta sobre outro estado.
  if (ctx.produtor.uf === uf && ctx.produtor.lat != null && ctx.produtor.lon != null) {
    const previsao = await buscarPrevisaoPorCoordenadas(ctx.produtor.lat, ctx.produtor.lon);
    if (previsao) {
      return {
        encontrado: true,
        local_usado: ctx.produtor.municipio ?? uf,
        fonte: "coordenada_cadastrada",
        previsao,
        calendario: montarCalendario(previsao.dias),
      };
    }
  }

  const previsao = await buscarPrevisao(uf);
  if (!previsao) return { encontrado: false };
  return {
    encontrado: true,
    local_usado: uf,
    fonte: "capital_estado",
    previsao,
    calendario: montarCalendario(previsao.dias),
  };
}
