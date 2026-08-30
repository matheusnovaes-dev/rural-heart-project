// Nem toda cultura do catálogo da Conab tem contrato futuro na B3 (só 7
// commodities agro têm) — mapeamento explícito em vez de tentar bater
// substring, porque "soja" tem 2 contratos genuinamente diferentes (SJC
// referencia CME, SOY referencia o preço FOB Santos direto — vale mostrar
// os dois) e "cana de açúcar" não tem contrato próprio, só o de etanol
// (proxy declarado, não é a mesma coisa e o rótulo deixa isso claro).
//
// Compartilhado entre ContextoMercado (mostra os números) e o cálculo do
// sinal de venda (cruza os números) — um só lugar de verdade pro mapeamento.
export const CULTURA_PARA_B3: Record<string, string[]> = {
  boi: ["BGI"],
  milho: ["CCM"],
  "café arábica": ["ICF"],
  "café conillon": ["CNL"],
  soja: ["SJC", "SOY"],
  "cana de açúcar": ["ETH"],
};
