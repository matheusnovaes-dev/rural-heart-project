// Coordenadas da capital de cada UF — usado só como fallback de coordenada
// bruta quando o CPTEC (fonte oficial, ver abaixo) não responde.
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

// Código de cidade do CPTEC/INPE (servicos.cptec.inpe.br) pra cada capital
// — API oficial do governo brasileiro, testada em produção como muito mais
// rápida e confiável que a Open-Meteo saindo do Cloudflare Workers (a
// Open-Meteo funciona bem de fora do Workers; especificamente saindo do
// Workers, tem falha/instabilidade alta — provável throttling agregado de
// IP compartilhado numa API pública gratuita, sem chave). Levantado à mão
// via GET /XML/listaCidades?city=<nome> em 2026-09-02.
export const capitalCptecPorUf: Record<string, number> = {
  SE: 220,
  PA: 221,
  MG: 222,
  RR: 223,
  DF: 224,
  MS: 225,
  MT: 226,
  PR: 227,
  SC: 228,
  CE: 229,
  GO: 230,
  PB: 231,
  AP: 232,
  AL: 233,
  AM: 234,
  RN: 235,
  TO: 236,
  RS: 237,
  RO: 238,
  PE: 239,
  AC: 240,
  RJ: 241,
  BA: 242,
  MA: 243,
  SP: 244,
  PI: 245,
  ES: 246,
};

// Legenda oficial dos códigos de condição do tempo do CPTEC — usado só pra
// texto legível; o número de chuva (chuvaPct) é uma estimativa aproximada
// derivada dessa condição (o CPTEC não dá probabilidade numérica de chuva
// como a Open-Meteo dá, só uma condição categórica).
const CONDICAO_CPTEC: Record<string, string> = {
  cl: "céu claro",
  ps: "predomínio de sol",
  pn: "parcialmente nublado",
  n: "nublado",
  e: "encoberto",
  nv: "nevoeiro",
  cv: "chuvisco",
  pp: "possibilidade de pancadas de chuva",
  pc: "pancadas de chuva",
  np: "nublado com pancadas de chuva",
  ec: "encoberto com chuvas isoladas",
  ci: "chuvas isoladas",
  c: "chuva",
  ch: "chuvoso",
  in: "tempo instável",
  t: "tempestade",
  g: "geada",
  ne: "neve",
};

function chuvaPctDaCondicao(codigo: string): number {
  const base = codigo.replace(/[mtn]$/, ""); // tira sufixo de período do dia (manhã/tarde/noite)
  if (["t"].includes(base)) return 90;
  if (["c", "ch", "ci", "ec"].includes(base)) return 80;
  if (["pp", "pc", "np", "cv"].includes(base)) return 60;
  if (["n", "e", "in", "nv"].includes(base)) return 30;
  if (["g", "ne"].includes(base)) return 5;
  return 10; // cl, ps, pn — tempo bom
}

export type Previsao = {
  dias: string[];
  chuvaPct: number[];
  tempMax: number[];
  tempMin: number[];
  /** Texto legível da condição do dia (só quando a fonte é o CPTEC). */
  condicaoTexto?: (string | null)[];
  fonte: "CPTEC/INPE" | "Open-Meteo";
};

// Medido ao vivo em produção: da Cloudflare Workers até a Open-Meteo, o
// request legítimo (sem nada de errado) já leva bem mais que os 4s que a
// v1 desse retry dava — com esse timeout curto, as duas tentativas batiam
// o limite e matavam requests que ainda iam completar, o que é PIOR do que
// não ter retry nenhum (dobra a espera sem nunca deixar completar). Uma
// tentativa só, com timeout generoso o bastante pra essa latência real,
// bate melhor que várias tentativas curtas — retry só ajuda quando a causa
// é uma falha rápida passageira, não quando é lentidão consistente.
const TIMEOUT_MS = 15000;
// O CPTEC respondeu consistentemente rápido (<1s) nos testes — timeout bem
// menor, então uma falha dele não consome o orçamento todo antes de cair
// pro fallback da Open-Meteo.
const TIMEOUT_CPTEC_MS = 6000;

async function fetchComTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Extrai os blocos <previsao>...</previsao> do XML do CPTEC sem depender de parser XML. */
function parsePrevisaoCptec(xml: string): Previsao | null {
  const blocos = [...xml.matchAll(/<previsao>(.*?)<\/previsao>/g)];
  if (blocos.length === 0) return null;

  const dias: string[] = [];
  const chuvaPct: number[] = [];
  const tempMax: number[] = [];
  const tempMin: number[] = [];
  const condicaoTexto: (string | null)[] = [];

  for (const bloco of blocos) {
    const corpo = bloco[1] ?? "";
    const dia = corpo.match(/<dia>(.*?)<\/dia>/)?.[1];
    const tempo = corpo.match(/<tempo>(.*?)<\/tempo>/)?.[1]?.trim();
    const maxima = corpo.match(/<maxima>(.*?)<\/maxima>/)?.[1];
    const minima = corpo.match(/<minima>(.*?)<\/minima>/)?.[1];
    if (!dia || !tempo || maxima == null || minima == null) continue;
    dias.push(dia);
    tempMax.push(Number(maxima));
    tempMin.push(Number(minima));
    chuvaPct.push(chuvaPctDaCondicao(tempo));
    condicaoTexto.push(CONDICAO_CPTEC[tempo] ?? null);
  }
  if (dias.length === 0) return null;
  return { dias, chuvaPct, tempMax, tempMin, condicaoTexto, fonte: "CPTEC/INPE" };
}

async function buscarPrevisaoCptecPorCodigo(codigoCidade: number): Promise<Previsao | null> {
  const res = await fetchComTimeout(
    `https://servicos.cptec.inpe.br/XML/cidade/${codigoCidade}/previsao.xml`,
    TIMEOUT_CPTEC_MS,
  );
  if (!res) return null;
  return parsePrevisaoCptec(await res.text());
}

/**
 * Previsão pra uma coordenada exata (cidade do produtor) em vez da capital
 * do estado — mesma fonte, só que sem a aproximação de "toda a UF tem o
 * clima da capital dela", que é imprecisa de verdade (BETO, concorrente
 * direto nesse recurso, já usa coordenada da propriedade). O CPTEC não
 * aceita lat/lon bruto (só código de cidade), então esse caminho específico
 * fica só na Open-Meteo.
 */
export async function buscarPrevisaoPorCoordenadas(
  lat: number,
  lon: number,
): Promise<Previsao | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  const res = await fetchComTimeout(url);
  if (!res) return null;
  const json = await res.json();
  return {
    dias: json.daily.time,
    chuvaPct: json.daily.precipitation_probability_max,
    tempMax: json.daily.temperature_2m_max,
    tempMin: json.daily.temperature_2m_min,
    fonte: "Open-Meteo",
  };
}

/** Previsão pra capital de uma UF — tenta o CPTEC (oficial) primeiro, cai pra Open-Meteo se falhar. */
export async function buscarPrevisao(uf: string): Promise<Previsao | null> {
  const codigoCptec = capitalCptecPorUf[uf];
  if (codigoCptec) {
    const viaCptec = await buscarPrevisaoCptecPorCodigo(codigoCptec);
    if (viaCptec) return viaCptec;
  }
  const coords = capitalPorUf[uf];
  if (!coords) return null;
  const [lat, lon] = coords;
  return buscarPrevisaoPorCoordenadas(lat, lon);
}

export type MunicipioEncontrado = { nome: string; lat: number; lon: number };

// A busca do CPTEC não aceita acento em UTF-8 percent-encoded — testado ao
// vivo: "Rondon%C3%B3polis" (com ó) devolve lista vazia, "Rondonopolis"
// (sem acento) acha certinho. Normaliza removendo os acentos antes de
// buscar — nome do produtor real vem naturalmente acentuado.
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function buscarCodigoCidadeCptec(nome: string, uf: string): Promise<number | null> {
  const res = await fetchComTimeout(
    `https://servicos.cptec.inpe.br/XML/listaCidades?city=${encodeURIComponent(semAcento(nome))}`,
    TIMEOUT_CPTEC_MS,
  );
  if (!res) return null;
  const xml = await res.text();
  // <cidade><nome>...</nome><uf>PR</uf><id>123</id></cidade> — nome vem em
  // ISO-8859-1 (às vezes ilegível aqui), então desambigua só pela UF, que é
  // sempre ASCII puro.
  const blocos = [...xml.matchAll(/<cidade>(.*?)<\/cidade>/g)];
  for (const bloco of blocos) {
    const corpo = bloco[1] ?? "";
    const ufBloco = corpo.match(/<uf>(.*?)<\/uf>/)?.[1];
    const id = corpo.match(/<id>(.*?)<\/id>/)?.[1];
    if (ufBloco === uf && id) return Number(id);
  }
  return null;
}

/**
 * Previsão pra uma cidade pelo nome, dentro de uma UF (desambigua — várias
 * cidades brasileiras têm nome repetido em estados diferentes). Tenta o
 * CPTEC primeiro (oficial); se a cidade não constar lá ou o serviço falhar,
 * cai pra geocodificação + previsão via Open-Meteo.
 */
export async function buscarPrevisaoPorNomeDeCidade(
  nome: string,
  uf: string,
  nomeCompletoUf: string,
): Promise<{ nomeUsado: string; previsao: Previsao } | null> {
  const codigo = await buscarCodigoCidadeCptec(nome, uf);
  if (codigo) {
    const previsao = await buscarPrevisaoCptecPorCodigo(codigo);
    if (previsao) return { nomeUsado: nome, previsao };
  }
  const municipio = await buscarMunicipio(nome, nomeCompletoUf);
  if (!municipio) return null;
  const previsao = await buscarPrevisaoPorCoordenadas(municipio.lat, municipio.lon);
  if (!previsao) return null;
  return { nomeUsado: municipio.nome, previsao };
}

/**
 * Geocodifica um nome de cidade dentro de uma UF (Open-Meteo). Precisa da
 * UF pra desambiguar — várias cidades brasileiras têm o mesmo nome em
 * estados diferentes (ex: 3 "Bambuí": MG, PA, RJ) — sem esse filtro,
 * pegaria a primeira da lista sem critério.
 */
export async function buscarMunicipio(
  nome: string,
  nomeCompletoUf: string,
): Promise<MunicipioEncontrado | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=10&language=pt&countryCode=BR`;
  const res = await fetchComTimeout(url);
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
