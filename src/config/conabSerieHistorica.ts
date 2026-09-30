// A tabela producao_historica_conab guarda o "produto" exatamente como o
// painel público da Conab (Série Histórica de Safra - Grãos) escreve: maiúsculo,
// sem acento. Nosso catálogo (config/culturas.ts) usa minúsculo com acento —
// esse mapa liga os dois só pras 18 culturas de grãos que o painel cobre
// (boi, café, suíno, frango, hortaliças etc. não têm nada aqui).
export const CULTURA_PARA_CONAB_HISTORICO: Record<string, string> = {
  "algodão em caroço": "ALGODAO EM CAROCO",
  "algodão em pluma": "ALGODAO EM PLUMA",
  amendoim: "AMENDOIM",
  arroz: "ARROZ",
  aveia: "AVEIA",
  canola: "CANOLA",
  "caroço de algodão": "CAROCO DE ALGODAO",
  centeio: "CENTEIO",
  cevada: "CEVADA",
  feijão: "FEIJAO",
  gergelim: "GERGELIM",
  girassol: "GIRASSOL",
  "mamona em baga": "MAMONA EM BAGA",
  milho: "MILHO",
  soja: "SOJA",
  "sorgo granífero": "SORGO GRANIFERO",
  trigo: "TRIGO",
  triticale: "TRITICALE",
};
