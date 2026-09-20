// Mesmo catálogo de produtos que o ingest da Conab cobre (77 culturas).
// `value` é o termo usado no filtro `.ilike("produto", "%valor%")` contra a
// coluna `produto` (que guarda o nome completo, ex: "SOJA EM GRÃOS (60 kg)").
export type Cultura = { value: string; label: string };

const CATALOGO: Cultura[] = [
  { value: "abacaxi", label: "Abacaxi" },
  { value: "açaí", label: "Açaí" },
  { value: "algodão em caroço", label: "Algodão em caroço" },
  { value: "algodão em pluma", label: "Algodão em pluma" },
  { value: "alho", label: "Alho" },
  { value: "amêndoa de andiroba", label: "Amêndoa de andiroba" },
  { value: "amêndoa de baru", label: "Amêndoa de baru" },
  { value: "amendoim", label: "Amendoim" },
  { value: "arroz", label: "Arroz" },
  { value: "azeite de babaçu", label: "Azeite de babaçu" },
  { value: "azeite de macaúba", label: "Azeite de macaúba" },
  { value: "banana", label: "Banana" },
  { value: "baru", label: "Baru" },
  { value: "batata", label: "Batata" },
  { value: "batata-doce", label: "Batata-doce" },
  { value: "boi", label: "Boi gordo (carne bovina)" },
  { value: "borracha", label: "Borracha" },
  { value: "buriti", label: "Buriti" },
  { value: "cacau cultivado", label: "Cacau cultivado" },
  { value: "cacau extrativo", label: "Cacau extrativo" },
  { value: "café arábica", label: "Café arábica" },
  { value: "café conillon", label: "Café conillon" },
  { value: "cana de açúcar", label: "Cana-de-açúcar" },
  { value: "canola", label: "Canola" },
  { value: "cará", label: "Cará" },
  { value: "carne caprina", label: "Carne caprina" },
  { value: "carne ovina", label: "Carne ovina" },
  { value: "caroço de algodão", label: "Caroço de algodão" },
  { value: "castanha de babaçu", label: "Castanha de babaçu" },
  { value: "castanha de caju", label: "Castanha de caju" },
  { value: "castanha do brasil", label: "Castanha do Brasil" },
  { value: "cebola", label: "Cebola" },
  { value: "coco de babaçu", label: "Coco de babaçu" },
  { value: "erva mate", label: "Erva-mate" },
  { value: "farinha de mandioca", label: "Farinha de mandioca" },
  { value: "feijão", label: "Feijão" },
  { value: "frango", label: "Frango" },
  { value: "inhame", label: "Inhame" },
  { value: "juçara", label: "Juçara" },
  { value: "juta", label: "Juta" },
  { value: "laranja", label: "Laranja" },
  { value: "leite de cabra", label: "Leite de cabra" },
  { value: "leite de vaca", label: "Leite de vaca" },
  { value: "maçã", label: "Maçã" },
  { value: "macaúba", label: "Macaúba" },
  { value: "malva", label: "Malva" },
  { value: "mamona em baga", label: "Mamona em baga" },
  { value: "manga", label: "Manga" },
  { value: "mangaba", label: "Mangaba" },
  { value: "maracujá", label: "Maracujá" },
  { value: "mel de abelha", label: "Mel de abelha" },
  { value: "milho", label: "Milho" },
  { value: "murumuru", label: "Murumuru" },
  { value: "óleo de babaçu", label: "Óleo de babaçu" },
  { value: "óleo de murumuru", label: "Óleo de murumuru" },
  { value: "óleo de pequi", label: "Óleo de pequi" },
  { value: "ovos de galinha", label: "Ovos de galinha" },
  { value: "piaçava", label: "Piaçava" },
  { value: "pimenta do reino", label: "Pimenta do reino" },
  { value: "pinhão", label: "Pinhão" },
  { value: "polpa de buriti", label: "Polpa de buriti" },
  { value: "polvilho", label: "Polvilho" },
  { value: "raiz de mandioca", label: "Raiz de mandioca" },
  { value: "sisal", label: "Sisal" },
  { value: "soja", label: "Soja" },
  { value: "sorgo granífero", label: "Sorgo granífero" },
  { value: "suíno", label: "Suíno" },
  { value: "tangerina", label: "Tangerina" },
  { value: "tomate", label: "Tomate" },
  { value: "trigo", label: "Trigo" },
  { value: "umbu", label: "Umbu" },
  { value: "uva", label: "Uva" },
];

/**
 * Só entram no catálogo culturas com preço de verdade na base (conferido em
 * 2026-09-20: "carne bovina", "farelo de soja" e "farinha de trigo" tinham zero
 * linhas em qualquer estado e foram tiradas; quem digitava "carne bovina" via
 * um painel vazio, ver ALIAS_CULTURA). Ordem: as mais usadas primeiro, o resto
 * em ordem alfabética.
 */
export const DESTAQUES = [
  "soja",
  "milho",
  "boi",
  "leite de vaca",
  "café arábica",
  "café conillon",
  "feijão",
  "arroz",
  "trigo",
  "algodão em pluma",
  "cana de açúcar",
  "suíno",
  "frango",
];

export const culturas: Cultura[] = [
  ...DESTAQUES.map((v) => CATALOGO.find((c) => c.value === v)).filter((c): c is Cultura => !!c),
  ...CATALOGO.filter((c) => !DESTAQUES.includes(c.value)),
];

/**
 * Nomes que o produtor (ou o cadastro antigo) usa pra uma cultura que a base
 * chama de outro jeito. A carne bovina é o boi gordo (arroba de 15 kg).
 */
const ALIAS_CULTURA: Record<string, string> = {
  "carne bovina": "boi",
  "carne de boi": "boi",
  "boi gordo": "boi",
  gado: "boi",
  "gado de corte": "boi",
  bovino: "boi",
  bovinos: "boi",
  "pecuária de corte": "boi",
};

/** Cultura como a base de preços a conhece: minúscula, sem espaço nas pontas e sem apelido. */
export function normalizarCultura(cultura: string): string {
  const c = cultura.trim().toLowerCase();
  return ALIAS_CULTURA[c] ?? c;
}

export const ehBoi = (cultura: string | null | undefined): boolean =>
  !!cultura && normalizarCultura(cultura) === "boi";
