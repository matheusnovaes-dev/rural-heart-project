/**
 * Confere se o produto que a ferramenta de preço consultou é o que o produtor perguntou. Achado na auditoria de
 * 2026-10-16: "qiero sabe o preco do mio" voltou com o preço da SOJA (cultura padrão do cadastro) escrito como se fosse
 * do milho. Os números eram reais (vieram da ferramenta), então o guarda de valores não pegava: o erro era o produto.
 */
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const CULTURAS = [
  "soja",
  "milho",
  "boi",
  "cafe",
  "trigo",
  "arroz",
  "feijao",
  "algodao",
  "leite",
  "cana",
];
const ALIAS: Record<string, string> = {
  gado: "boi",
  bovino: "boi",
  conillon: "cafe",
  conilon: "cafe",
  arabica: "cafe",
};
const IGNORAR = new Set(["mil", "cada", "caso", "coisa", "cana"].filter((p) => p !== "cana"));

function ehSubsequencia(curta: string, longa: string): boolean {
  let i = 0;
  for (const c of longa) if (c === curta[i]) i++;
  return i === curta.length;
}

function distancia(a: string, b: string): number {
  const d = Array.from(
    { length: a.length + 1 },
    (_, i) => [i, ...Array(b.length).fill(0)] as number[],
  );
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length]![b.length]!;
}

function culturaDaPalavra(w: string): string | null {
  if (IGNORAR.has(w)) return null;
  if (ALIAS[w]) return ALIAS[w]!;
  if (CULTURAS.includes(w)) return w;
  if (w.length < 3) return null;
  for (const k of CULTURAS) {
    // "mio" -> milho, "soj" -> soja: letras na ordem, mesma inicial, poucas faltando
    if (w[0] === k[0] && ehSubsequencia(w, k) && k.length - w.length <= 3 && w.length >= 3)
      return k;
    if (w.length >= 5 && distancia(w, k) <= 1) return k;
  }
  return null;
}

/** Culturas citadas no texto, inclusive com erro de digitação ("mio" = milho), sem exigir pergunta de preço. */
export function culturasNoTexto(texto: string): string[] {
  const achadas = new Set<string>();
  for (const w of semAcento(texto)
    .split(/[^a-z]+/)
    .filter(Boolean)) {
    const c = culturaDaPalavra(w);
    if (c) achadas.add(c);
  }
  return [...achadas];
}

/** Culturas que o produtor citou na mensagem (inclusive com erro de digitação), sem repetir. */
export function culturasPerguntadas(texto: string): string[] {
  const t = semAcento(texto);
  if (t.length > 100 || !/preco|quanto|cota|saca|arroba|vale|\bta\b|valor|hoje|agora/.test(t))
    return [];
  const achadas = new Set<string>();
  for (const w of t.split(/[^a-z]+/).filter(Boolean)) {
    const c = culturaDaPalavra(w);
    if (c) achadas.add(c);
  }
  return [...achadas];
}

/** Culturas que `buscar_preco` consultou neste turno (campo `produto` de cada chamada). */
export function culturasNaoConsultadas(
  perguntadas: string[],
  produtosConsultados: string[],
): string[] {
  const consultados = produtosConsultados.map(semAcento);
  return perguntadas.filter((c) => {
    const procurar = c === "boi" ? ["boi", "bezerr", "garrote", "novilha", "vaca"] : [c];
    return !consultados.some((p) => procurar.some((x) => p.includes(x)));
  });
}
