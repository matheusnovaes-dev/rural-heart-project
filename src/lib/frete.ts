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

/**
 * Entre várias rotas de frete cadastradas pra mesma cultura/UF, escolhe a
 * de origem geograficamente mais próxima do produtor. Antes disso, o app
 * pegava qualquer rota do mesmo estado (a primeira que o banco devolvesse)
 * — real para GO por exemplo, com ~20 rotas cadastradas, podia mostrar o
 * frete de uma cidade a 400km de distância do produtor. Sem a cidade do
 * produtor cadastrada (ou sem coordenada em nenhuma rota), cai de volta no
 * comportamento antigo: pega a primeira rota disponível.
 */
export function escolherRotaMaisProxima<
  T extends { lat_origem: number | null; lon_origem: number | null },
>(rotas: T[], produtorLat: number | null, produtorLon: number | null): T | null {
  if (rotas.length === 0) return null;
  if (produtorLat == null || produtorLon == null) return rotas[0]!;

  const comCoordenada = rotas.filter((r) => r.lat_origem != null && r.lon_origem != null);
  if (comCoordenada.length === 0) return rotas[0]!;

  return comCoordenada.reduce((maisProxima, atual) => {
    const distAtual = distanciaKm(produtorLat, produtorLon, atual.lat_origem!, atual.lon_origem!);
    const distMaisProxima = distanciaKm(
      produtorLat,
      produtorLon,
      maisProxima.lat_origem!,
      maisProxima.lon_origem!,
    );
    return distAtual < distMaisProxima ? atual : maisProxima;
  });
}
