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
  // Achado real testando bateria adversarial (2026-10-09): tinha preço de
  // verdade na base (EPAGRI-SC) mas nunca tinha entrado no catálogo —
  // omissão, não exclusão deliberada como os 3 casos documentados acima.
  { value: "aveia", label: "Aveia" },
  { value: "azeite de babaçu", label: "Azeite de babaçu" },
  { value: "azeite de macaúba", label: "Azeite de macaúba" },
  { value: "banana", label: "Banana" },
  // Reposição bovina (IEA-SP, Epagri-SC): tinha preço no banco e ninguém conseguia pedir (2026-10-15).
  // Bezerro, bezerra, garrote e vaca magra são preço por cabeça ("unidade").
  { value: "bezerra", label: "Bezerra" },
  { value: "bezerro", label: "Bezerro" },
  { value: "garrote", label: "Garrote" },
  { value: "novilha", label: "Novilha" },
  { value: "vaca gorda", label: "Vaca gorda" },
  { value: "vaca magra", label: "Vaca magra" },
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
  // Mesmo achado do aveia acima: tem preço real (EPAGRI-SC, IEA-SP), só
  // "farinha de mandioca" e "raiz de mandioca" (derivados) tinham entrado.
  { value: "mandioca", label: "Mandioca" },
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
  // Hortifrúti com preço mensal do IEA-SP (estado de SP), pedido do Matheus em 2026-10-22.
  { value: "abacate", label: "Abacate" },
  { value: "abóbora", label: "Abóbora" },
  { value: "abobrinha", label: "Abobrinha" },
  { value: "alface", label: "Alface" },
  { value: "beterraba", label: "Beterraba" },
  { value: "caqui", label: "Caqui" },
  { value: "cenoura", label: "Cenoura" },
  { value: "figo", label: "Figo" },
  { value: "goiaba", label: "Goiaba" },
  { value: "limão", label: "Limão" },
  { value: "melancia", label: "Melancia" },
  { value: "morango", label: "Morango" },
  { value: "pêssego", label: "Pêssego" },
  { value: "pimentão", label: "Pimentão" },
  { value: "repolho", label: "Repolho" },
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
  caprino: "carne caprina",
  caprinos: "carne caprina",
  cabra: "carne caprina",
  cabras: "carne caprina",
  ovino: "carne ovina",
  ovinos: "carne ovina",
  ovelha: "carne ovina",
  ovelhas: "carne ovina",
  carneiro: "carne ovina",
  carneiros: "carne ovina",
  cordeiro: "carne ovina",
  cordeiros: "carne ovina",
  // "cana" é como o produtor fala (6 dos 10 clientes de cana estão em SP): sem o apelido, "preço da cana em SP" não
  // contava como cultura citada e o código trocava a busca pela cultura do cadastro (2026-10-22).
  cana: "cana de açúcar",
  "cana-de-açúcar": "cana de açúcar",
  "cana de acucar": "cana de açúcar",
  porco: "suíno",
  porcos: "suíno",
  suínos: "suíno",
  suinos: "suíno",
  galinha: "frango",
  galinhas: "frango",
  frangos: "frango",
  // Achado real testando bateria adversarial (2026-10-09): produtor fala
  // "sorgo" (forma comum), a base só tem o nome técnico completo "sorgo
  // granífero" — sem o apelido, "sorgo" sozinho nunca batia.
  sorgo: "sorgo granífero",
  // Achado real 2026-10-15 (print do Matheus): "quanto ta o cafe em mg?" não contava como cultura
  // citada, o código trocava a busca pela cultura do cadastro (soja) e o bot respondia preço de
  // soja no lugar do café. "café" sem tipo é uma cultura citada; o tipo é decidido por
  // `tipoDeCafePadrao`.
  café: "café",
  // Quem já está falando de café diz só o tipo ("e o conillon no ES?"): sem isso a pergunta de
  // acompanhamento era lida como "sem cultura" e voltava para o café arábica do histórico.
  // "Algodão" sozinho é a pluma (o preço que o produtor acompanha); caroço tem unidade e preço
  // outros e misturava na lista de referências (R$/t ao lado de R$/@).
  algodão: "algodão em pluma",
  ovo: "ovos de galinha",
  ovos: "ovos de galinha",
  conillon: "café conillon",
  conilon: "café conillon",
  robusta: "café conillon",
  arábica: "café arábica",
  arabica: "café arábica",
};

const UFS_DE_CONILLON = new Set(["ES", "RO", "AC", "AM", "PA", "MT"]);

/**
 * "Café" sem tipo: usa o tipo do cadastro do produtor quando ele já é café; senão o mais comum na
 * UF (conillon no ES e na Amazônia, arábica no resto). O bot sempre diz qual tipo considerou.
 */
export function tipoDeCafePadrao(
  uf: string,
  culturaCadastrada?: string | null,
): "café arábica" | "café conillon" {
  const c = (culturaCadastrada ?? "").toLowerCase();
  if (c.includes("conillon") || c.includes("conilon") || c.includes("robusta"))
    return "café conillon";
  if (c.includes("arábica") || c.includes("arabica")) return "café arábica";
  return UFS_DE_CONILLON.has(uf.toUpperCase()) ? "café conillon" : "café arábica";
}

/** Cultura como a base de preços a conhece: minúscula, sem espaço nas pontas e sem apelido. */
export function normalizarCultura(cultura: string): string {
  const c = cultura.trim().toLowerCase();
  return ALIAS_CULTURA[c] ?? c;
}

export const ehBoi = (cultura: string | null | undefined): boolean =>
  !!cultura && normalizarCultura(cultura) === "boi";

// Achado real testando ao vivo (2026-10-09): termo composto com espaço (ex:
// "cana de açúcar", como o catálogo grava) nunca bate via `.ilike("produto",
// "%termo%")` contra uma fonte que grava o mesmo produto com hífen (ex:
// "Cana-de-açúcar" no IBGE, "CANA-DE-AÇÚCAR (DERAL-PR)" nos preços do
// Paraná) — ilike é busca por SUBSTRING literal, espaço não é hífen. Usado
// em qualquer `.ilike("produto", ...)` que recebe um termo vindo do
// catálogo (buscar_preco, buscar_producao_ibge, buscar_sinal_venda):
// junta cada palavra com "%" (curinga do padrão LIKE) em vez de espaço
// literal, casando hífen, espaço ou nenhum separador.
export function padraoIlikePorPalavra(termo: string): string {
  return `%${termo.trim().split(/\s+/).join("%")}%`;
}

// Achado real 2026-10-15: o Thiago (SP, café arábica) recebeu "ainda não temos preço de café
// arábica em São Paulo" com R$1.750 do IEA-SP no banco. Essas fontes gravam o arábica como "CAFÉ
// BENEFICIADO ..." (IEA-SP, Deral/PR) sem a palavra "arábica", e a busca por palavras nunca casava.
// Só entra aqui o que for do mesmo produto: o "café cereja descascado" do IEA-SP é outro estágio
// (outro preço) e fica de fora para não misturar na média das praças.
const NOMES_NA_BASE: Record<string, string[]> = {
  "café arábica": ["café*arábica*", "café*beneficiado*"],
  // O IEA-SP grava "OVO TIPO EXTRA BRANCO" (sem "galinha") e a Conab "OVOS DE GALINHA GRANDE BRANCO".
  "ovos de galinha": ["ovos*galinha*", "ovo*tipo*"],
};

type FiltravelPorProduto<Q> = {
  ilike: (coluna: string, padrao: string) => Q;
  or: (filtros: string) => Q;
};

/**
 * Filtro de `produto` na tabela de preços para uma cultura do catálogo. Igual ao antigo
 * `.ilike("produto", padraoIlikePorPalavra(x))`, mas cobre o nome que cada fonte usa para o mesmo
 * produto (ver NOMES_NA_BASE). `modo: "substring"` mantém o `%termo%` literal de quem o usava.
 */
export function filtrarPorProduto<Q extends FiltravelPorProduto<Q>>(
  q: Q,
  cultura: string,
  modo: "palavra" | "substring" = "palavra",
): Q {
  const variantes = NOMES_NA_BASE[normalizarCultura(cultura)];
  if (variantes) return q.or(variantes.map((v) => `produto.ilike.${v}`).join(","));
  return q.ilike("produto", modo === "palavra" ? padraoIlikePorPalavra(cultura) : `%${cultura}%`);
}

// Todo termo reconhecido (catálogo + apelidos), do mais específico (mais
// palavras) pro mais genérico — "café arábica" tem que casar antes de
// "café" sozinho não existir no catálogo evitar, e termos compostos tipo
// "cana de açúcar" precisam vencer antes de um eventual termo mais curto
// que seja substring dele.
const TERMOS_CULTURA = [...CATALOGO.map((c) => c.value), ...Object.keys(ALIAS_CULTURA)].sort(
  (a, b) => b.length - a.length,
);

// Achado real testando ao vivo (2026-10-09): "cafe conillon" (sem acento,
// como gente digita de verdade no WhatsApp) não casava contra "café
// conillon" do catálogo — comparação de string trata "e" e "é" como
// caracteres diferentes. Casa ambos os lados sem acento, mas devolve a
// forma ORIGINAL do catálogo (com acento), que é o que normalizarCultura e
// o resto do código esperam.
function removerAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const TERMO_SEM_ACENTO_PARA_ORIGINAL = new Map(
  TERMOS_CULTURA.map((t) => [removerAcentos(t).toLowerCase(), t]),
);
const REGEX_CULTURA_CATALOGO = new RegExp(
  `\\b(${TERMOS_CULTURA.map((t) => removerAcentos(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i",
);

/**
 * Acha o termo de cultura (já normalizado pro nome que a base usa) numa
 * string de texto livre, ou null se nenhuma das 77 culturas/apelidos
 * aparecer. Usado pra detectar se a mensagem ATUAL (ou uma linha do
 * histórico) menciona cultura explicitamente, sem depender do modelo
 * decidir isso sozinho — mesmo motivo de sempre: contexto entre turnos não
 * é confiável só com prompt (ver calculadora.ts e tools/index.ts).
 */
export function culturaMencionada(texto: string): string | null {
  const m = removerAcentos(texto).match(REGEX_CULTURA_CATALOGO);
  if (!m) return null;
  const original = TERMO_SEM_ACENTO_PARA_ORIGINAL.get(m[1]!.toLowerCase()) ?? m[1]!;
  return normalizarCultura(original);
}

function distanciaTrocaVizinha(a: string, b: string): number {
  // Damerau-Levenshtein: trocar duas letras vizinhas ("sioja") conta como 1 erro de digitação.
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Cultura PARECIDA com o que a pessoa escreveu ("sója", "melho", "cafe arabica" mal escrito), só para o bot perguntar
 * "você quis dizer soja?". Nunca escolhe sozinho. Só vale com uma única candidata (empate entre culturas diferentes = null),
 * palavra de 4+ letras e no máximo 1 erro (2 em palavras de 7+ letras). Texto que já é uma cultura reconhecida devolve null.
 */
export function culturaParecida(texto: string): string | null {
  if (culturaMencionada(texto)) return null;
  const palavras = removerAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  if (palavras.length === 0 || palavras.length > 3) return null;
  const candidatos = new Map<string, number>();
  // "leite" não é item do catálogo (o bot trata à parte), mas é cultura que a pessoa pode digitar errado.
  const termos: [string, string][] = [
    ...TERMO_SEM_ACENTO_PARA_ORIGINAL,
    ["leite", "leite de vaca"],
  ];
  for (const [termo, original] of termos) {
    if (termo.length < 4) continue;
    const alvos = palavras.length > 1 ? [palavras.join(" "), ...palavras] : palavras;
    for (const w of alvos) {
      const limite = w.length >= 7 ? 2 : 1;
      if (Math.abs(w.length - termo.length) > limite) continue;
      if (w.length <= 5 && w[0] !== termo[0]) continue; // erro de digitação raramente troca a 1ª letra ("Dalva" não é "malva")
      const d = distanciaTrocaVizinha(w, termo);
      if (d <= limite) {
        const c = normalizarCultura(original);
        candidatos.set(c, Math.min(candidatos.get(c) ?? 99, d));
      }
    }
  }
  if (candidatos.size === 0) return null;
  const ordenados = [...candidatos.entries()].sort((x, y) => x[1] - y[1]);
  if (ordenados.length > 1 && ordenados[0]![1] === ordenados[1]![1]) return null;
  return ordenados[0]![0];
}

/** Todas as culturas do catálogo (ou apelidos) citadas no texto, já normalizadas e sem repetição, na ordem em que aparecem. */
export function culturasMencionadas(texto: string): string[] {
  const achadas: string[] = [];
  for (const m of removerAcentos(texto).matchAll(new RegExp(REGEX_CULTURA_CATALOGO.source, "gi"))) {
    const original = TERMO_SEM_ACENTO_PARA_ORIGINAL.get(m[1]!.toLowerCase()) ?? m[1]!;
    const c = normalizarCultura(original);
    if (!achadas.includes(c)) achadas.push(c);
  }
  return achadas;
}

/**
 * Achado real 2026-10-12 (print do Matheus: perguntou produção de soja,
 * pergunta de acompanhamento sem citar cultura voltou falando de preço de
 * MILHO): essa função assumia que `historico` já vinha em ordem cronológica
 * crescente (mais antiga primeiro) pra poder escanear de trás pra frente e
 * achar a mais recente. Só que o n8n busca o histórico com `ORDER BY ordem
 * DESC LIMIT 50` (mais recente primeiro) e manda esse array direto pro bot
 * — então escanear "de trás pra frente" num array DESC acha a cultura mais
 * ANTIGA da janela de 50 mensagens, não a mais recente. Nunca pegava em
 * teste local porque todo teste monta o histórico já em ordem crescente à
 * mão. Agora ordena por `ordem` primeiro, não confia na ordem de entrada.
 */
export function culturaMaisRecenteNoHistorico(
  historico: { conteudo: string; ordem: number }[],
): string | null {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  for (let i = ordenado.length - 1; i >= 0; i--) {
    const achada = culturaMencionada(ordenado[i]?.conteudo ?? "");
    if (achada) return achada;
  }
  return null;
}

/**
 * Derivados do grão (farelo, óleo de soja, casca, torta): têm preço próprio, por tonelada, da
 * indústria, e NÃO temos fonte pública diária deles. Nunca podem virar o preço do grão (visto em
 * produção: "o preço do farelo de soja em MT é R$ 137,88 por 60 kg", que era o da soja).
 */
const DERIVADO_DE_GRAO_RE =
  /\b(farelo|oleo de (soja|milho|girassol|algodao|canola)|casca de soja|torta de|bagaco de)\b/;
export function mencionaDerivadoDeGrao(texto: string): boolean {
  return DERIVADO_DE_GRAO_RE.test(removerAcentos(texto).toLowerCase());
}
