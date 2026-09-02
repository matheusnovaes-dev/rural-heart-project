// Coordenadas da capital de cada UF — suficiente pra uma tendência regional,
// sem precisar geocodificar a cidade exata de cada produtor.
export const capitalPorUf: Record<string, [number, number]> = {
  AC: [-9.97, -67.81],
  AL: [-9.65, -35.72],
  AP: [0.04, -51.05],
  AM: [-3.1, -60.02],
  BA: [-12.97, -38.51],
  CE: [-3.72, -38.54],
  DF: [-15.78, -47.93],
  ES: [-20.32, -40.34],
  GO: [-16.68, -49.25],
  MA: [-2.53, -44.3],
  MT: [-15.6, -56.1],
  MS: [-20.44, -54.65],
  MG: [-19.92, -43.94],
  PA: [-1.46, -48.5],
  PB: [-7.12, -34.88],
  PR: [-25.43, -49.27],
  PE: [-8.05, -34.9],
  PI: [-5.09, -42.8],
  RJ: [-22.91, -43.17],
  RN: [-5.79, -35.21],
  RS: [-30.03, -51.23],
  RO: [-8.76, -63.9],
  RR: [2.82, -60.67],
  SC: [-27.6, -48.55],
  SP: [-23.55, -46.63],
  SE: [-10.91, -37.07],
  TO: [-10.25, -48.32],
};

export type Previsao = {
  dias: string[];
  chuvaPct: number[];
  tempMax: number[];
  tempMin: number[];
};

// A Open-Meteo falha de forma intermitente (não é erro de lógica — o mesmo
// request às vezes funciona, às vezes não), observado direto em produção
// quando o bot do WhatsApp passou a chamar isso do lado servidor pela
// primeira vez. Uma tentativa só é frágil demais pra virar "não consegui
// buscar o clima" pro produtor por causa de uma falha de rede passageira.
// IMPORTANTE: cada tentativa tem um timeout curto — sem isso, uma resposta
// lenta (em vez de uma falha rápida) consome sozinha o orçamento de tempo
// do agente inteiro (25s), e 2-3 tentativas lentas em sequência estouram
// esse orçamento e derrubam a resposta inteira, não só o clima. Achado ao
// vivo: a v1 desse retry (sem timeout por tentativa) piorou a situação.
const TIMEOUT_POR_TENTATIVA_MS = 4000;

async function fetchComRetry(url: string, tentativas = 2): Promise<Response | null> {
  for (let i = 0; i < tentativas; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_POR_TENTATIVA_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) return res;
    } catch {
      // tenta de novo (ou desiste, se essa já foi a última tentativa)
    } finally {
      clearTimeout(timeout);
    }
    if (i < tentativas - 1) await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/**
 * Previsão pra uma coordenada exata (cidade do produtor) em vez da capital
 * do estado — mesma fonte, só que sem a aproximação de "toda a UF tem o
 * clima da capital dela", que é imprecisa de verdade (BETO, concorrente
 * direto nesse recurso, já usa coordenada da propriedade).
 */
export async function buscarPrevisaoPorCoordenadas(
  lat: number,
  lon: number,
): Promise<Previsao | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  const res = await fetchComRetry(url);
  if (!res) return null;
  const json = await res.json();
  return {
    dias: json.daily.time,
    chuvaPct: json.daily.precipitation_probability_max,
    tempMax: json.daily.temperature_2m_max,
    tempMin: json.daily.temperature_2m_min,
  };
}

export async function buscarPrevisao(uf: string): Promise<Previsao | null> {
  const coords = capitalPorUf[uf];
  if (!coords) return null;
  const [lat, lon] = coords;
  return buscarPrevisaoPorCoordenadas(lat, lon);
}

export type MunicipioEncontrado = { nome: string; lat: number; lon: number };

/**
 * Geocodifica um nome de cidade dentro de uma UF (mesma fonte gratuita da
 * previsão, Open-Meteo). Precisa da UF pra desambiguar — várias cidades
 * brasileiras têm o mesmo nome em estados diferentes (ex: 3 "Bambuí": MG,
 * PA, RJ) — sem esse filtro, pegaria a primeira da lista sem critério.
 */
export async function buscarMunicipio(
  nome: string,
  nomeCompletoUf: string,
): Promise<MunicipioEncontrado | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=10&language=pt&countryCode=BR`;
  const res = await fetchComRetry(url);
  if (!res) return null;
  const json = await res.json();
  const resultados: { name: string; latitude: number; longitude: number; admin1?: string }[] =
    json.results ?? [];
  // Sem fallback pro primeiro resultado se a UF não bater: melhor dizer
  // "não encontrei" do que devolver silenciosamente a coordenada de uma
  // cidade homônima em outro estado (achado testando com "Bambuí" + UF
  // errada de propósito — caía direto numa cidade de outro estado).
  const match = resultados.find((r) => r.admin1 === nomeCompletoUf);
  if (!match) return null;
  return { nome: match.name, lat: match.latitude, lon: match.longitude };
}
