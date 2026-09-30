// progresso_safra_conab guarda o "produto" como a Conab escreve no boletim
// semanal "Plantio e Colheita" — culturas com mais de uma safra no ano
// (milho, feijão) vêm com o sufixo "1ª"/"2ª" (ex: "Milho 2ª"), por isso o
// valor aqui é só a raiz (sem acento problemático de busca) e o tool usa
// ilike pra pegar todas as safras daquela cultura de uma vez.
export const CULTURA_PARA_CONAB_PROGRESSO: Record<string, string> = {
  "algodão em caroço": "Algodão",
  "algodão em pluma": "Algodão",
  amendoim: "Amendoim",
  arroz: "Arroz",
  aveia: "Aveia",
  canola: "Canola",
  centeio: "Centeio",
  cevada: "Cevada",
  feijão: "Feijão",
  gergelim: "Gergelim",
  girassol: "Girassol",
  "mamona em baga": "Mamona",
  milho: "Milho",
  soja: "Soja",
  "sorgo granífero": "Sorgo",
  trigo: "Trigo",
  triticale: "Triticale",
};
