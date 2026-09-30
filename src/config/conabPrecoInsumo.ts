// precos_insumos_conab guarda cada linha por produto COMERCIAL (marca), não
// por categoria — "quanto tá o glifosato" é uma busca por substring no nome
// do produto. Mas o produtor também pergunta de forma genérica ("e o
// fertilizante, tá subindo?"), sem citar marca ou princípio ativo nenhum —
// pra isso não ter fim morto, mapeia o nome da categoria (subgrupo, como a
// própria Conab chama) pra um filtro exato, usado só quando a busca por
// produto não acha nada.
export const CATEGORIA_PARA_SUBGRUPO_INSUMO: Record<string, string> = {
  acaricida: "ACARICIDA",
  adjuvante: "ESPALHANTE / ADJUVANTE",
  espalhante: "ESPALHANTE / ADJUVANTE",
  regulador: "ESTIMULANTE/REGULADOR DE CRESCIMENTO",
  estimulante: "ESTIMULANTE/REGULADOR DE CRESCIMENTO",
  fungicida: "FUNGICIDA",
  herbicida: "HERBICIDA",
  inseticida: "INSETICIDA",
  defensivo: "HERBICIDA", // sem mais contexto, herbicida é o mais perguntado
  inoculante: "INOCULANTE",
  "fertilizante organico": "ORGÂNICO",
  "fertilizante quimico": "QUÍMICO",
  fertilizante: "QUÍMICO", // idem — sem mais contexto, químico é o mais comum
  adubo: "QUÍMICO",
};
