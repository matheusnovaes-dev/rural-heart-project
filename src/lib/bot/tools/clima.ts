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
};

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
      };
    }
  }

  const previsao = await buscarPrevisao(uf);
  if (!previsao) return { encontrado: false };
  return { encontrado: true, local_usado: uf, fonte: "capital_estado", previsao };
}
