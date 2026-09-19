export type FreteRef = {
  cultura: string;
  municipio_origem: string;
  uf_origem: string;
  municipio_destino: string;
  uf_destino: string;
  frete_rt: number;
};

// Sacas de grãos (soja/milho) são sempre 60kg — mesmo padrão que a Conab já
// usa nos preços que exibimos, não é uma escolha nossa.
const KG_POR_SACA = 60;

/** Converte R$/t em R$/saca de 60kg e desconta do preço bruto. */
export function precoLiquido(precoBrutoPorSaca: number, freteRt: number) {
  const freteReaisPorSaca = (freteRt / 1000) * KG_POR_SACA;
  return precoBrutoPorSaca - freteReaisPorSaca;
}

const RAIO_TERRA_KM = 6371;

/** Distância em linha reta entre duas coordenadas (fórmula de Haversine). */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return RAIO_TERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Rota de frete de referência
// ---------------------------------------------------------------------------

/**
 * Portos de exportação de grãos que aparecem como destino na tabela de fretes.
 * O preço líquido só tem sentido comparável se o destino for sempre o mesmo
 * tipo de lugar: a tabela mistura porto (Santos, Paranaguá...) com mercado
 * interno (Natal, Teresina, Campina Grande, cidades de GO), e o app pegava a
 * primeira rota que o banco devolvesse, ou seja, um destino arbitrário. Achado
 * real: soja de MT com "líquido" calculado até o interior do Nordeste, com
 * frete muito maior que o do porto. Manaus e Porto Velho ficam de fora de
 * propósito: são polos de consumo, não porto de embarque de grão.
 */
const PORTOS_DE_EXPORTACAO = new Set(
  [
    "Santos",
    "Guarujá",
    "Paranaguá",
    "São Francisco do Sul",
    "Itajaí",
    "Imbituba",
    "Rio Grande",
    "Vitória",
    "São Luís",
    "Santarém",
    "Itaituba",
    "Barcarena",
    "Salvador",
    "Ilhéus",
  ].map((n) => normalizarNome(n)),
);

function normalizarNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function ehPortoDeExportacao(municipio: string): boolean {
  return PORTOS_DE_EXPORTACAO.has(normalizarNome(municipio));
}

type RotaParaEscolha = {
  municipio_origem: string;
  municipio_destino: string;
  frete_rt: number;
  lat_origem: number | null;
  lon_origem: number | null;
};

/**
 * Escolhe a rota de frete de referência entre as rotas de uma cultura numa UF:
 *  1. só rotas até porto de exportação (destino comparável entre estados);
 *  2. por origem, a rota mais barata até um porto (o porto que ela usaria);
 *  3. origem: a mais próxima da cidade do produtor, quando ele tem cidade
 *     cadastrada; senão a origem "do meio" do estado (mediana do frete até o
 *     porto), que é representativa e não puxa pro extremo mais perto ou mais
 *     longe.
 * Sem nenhuma rota até porto (RS, TO, RO e outros só têm rota pra mercado
 * interno), devolve null: sem rota de referência confiável é melhor mostrar só
 * o preço bruto do que um líquido calculado sobre um destino arbitrário.
 */
export function escolherFreteReferencia<T extends RotaParaEscolha>(
  rotas: T[],
  produtorLat: number | null,
  produtorLon: number | null,
): T | null {
  const maisBarataPorOrigem = new Map<string, T>();
  for (const r of rotas) {
    if (!ehPortoDeExportacao(r.municipio_destino)) continue;
    if (!Number.isFinite(r.frete_rt) || r.frete_rt <= 0) continue;
    const atual = maisBarataPorOrigem.get(r.municipio_origem);
    if (!atual || r.frete_rt < atual.frete_rt) maisBarataPorOrigem.set(r.municipio_origem, r);
  }
  const candidatas = [...maisBarataPorOrigem.values()];
  if (candidatas.length === 0) return null;

  const porOrigemEFrete = (a: T, b: T) =>
    a.frete_rt - b.frete_rt || a.municipio_origem.localeCompare(b.municipio_origem, "pt-BR");

  if (produtorLat != null && produtorLon != null) {
    const comCoordenada = candidatas.filter((r) => r.lat_origem != null && r.lon_origem != null);
    if (comCoordenada.length > 0) {
      return comCoordenada.reduce((melhor, atual) => {
        const dAtual = distanciaKm(produtorLat, produtorLon, atual.lat_origem!, atual.lon_origem!);
        const dMelhor = distanciaKm(
          produtorLat,
          produtorLon,
          melhor.lat_origem!,
          melhor.lon_origem!,
        );
        if (dAtual !== dMelhor) return dAtual < dMelhor ? atual : melhor;
        return porOrigemEFrete(atual, melhor) < 0 ? atual : melhor;
      });
    }
  }

  const ordenadas = [...candidatas].sort(porOrigemEFrete);
  return ordenadas[Math.floor((ordenadas.length - 1) / 2)]!;
}
