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
