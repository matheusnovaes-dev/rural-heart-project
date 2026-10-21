/**
 * Exemplos da landing (mock de chat e preview do painel). Antes eram texto
 * fixo ("janela abre em 21/09", dólar R$ 5,20) que envelhecia: numa página que
 * vende "dado de hoje", um exemplo datado de semanas atrás ensina o visitante a
 * desconfiar. Agora o dado vem do servidor (dólar, futuros da B3, ZARC) e, se
 * a busca falhar, os fallbacks abaixo usam datas RELATIVAS a hoje, nunca fixas.
 */

export type ExemplosDoDia = {
  dolar: { valor: number; data: string } | null;
  futuroSoja: {
    unidade: string;
    contratos: { vencimento: string; valor: number }[];
  } | null;
  /** Histórico real de uma praça de soja (últimos 90 dias), para o gráfico da prévia do painel no desktop. */
  serieSoja: { praca: string; pontos: { data: string; preco: number }[] } | null;
  plantio: {
    periodoAtual: string;
    riscoHoje: number | null;
    proximas: { periodo: string; risco: number | null }[];
  } | null;
};

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const MESES_COMPLETOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const brl2 = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2026-10-09" → "09/10" */
export function diaMes(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** "2027-01-01" → "jan/27" */
export function mesAnoCurto(iso: string): string {
  const mes = Number(iso.slice(5, 7)) - 1;
  return `${MESES_ABREV[mes] ?? ""}/${iso.slice(2, 4)}`;
}

/** Mesma convenção de decêndios (3 por mês) usada em src/lib/plantio.ts. */
export function rotuloDecendio(mes0: number, parte: 1 | 2 | 3): string {
  const faixa = parte === 1 ? "dia 1 a 10" : parte === 2 ? "dia 11 a 20" : "dia 21 ao fim do mês";
  return `${faixa} de ${MESES_COMPLETOS[mes0]}`;
}

/** Decêndio atual e os próximos (`quantidade` no total), a partir de `hoje`. */
export function proximosDecendios(hoje: Date, quantidade: number): string[] {
  const dia = hoje.getDate();
  let parte: 1 | 2 | 3 = dia <= 10 ? 1 : dia <= 20 ? 2 : 3;
  let mes = hoje.getMonth();
  const lista: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    lista.push(rotuloDecendio(mes, parte));
    if (parte === 3) {
      parte = 1;
      mes = (mes + 1) % 12;
    } else {
      parte = (parte + 1) as 2 | 3;
    }
  }
  return lista;
}

/** Data passada, relativa a hoje, no formato "dd/mm" (ex: alerta que disparou há 4 dias). */
export function haDiasAtras(hoje: Date, dias: number): string {
  const d = new Date(hoje);
  d.setDate(d.getDate() - dias);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Frase da resposta do bot sobre plantio, a partir do dado real do ZARC. */
export function fraseDePlantio(p: NonNullable<ExemplosDoDia["plantio"]>): string {
  if (p.riscoHoje != null) {
    return `Sim, a janela está aberta (${p.periodoAtual}), com risco climático de ${p.riscoHoje}% (ZARC/MAPA).`;
  }
  const proxima = p.proximas.find((j) => j.risco != null);
  return proxima
    ? `Ainda não. A próxima janela recomendada é ${proxima.periodo}, com risco climático de ${proxima.risco}% (ZARC/MAPA).`
    : "Ainda não é a época recomendada de plantio nessa região (ZARC/MAPA).";
}

/**
 * Veredito do "sinal de venda" do exemplo, derivado dos MESMOS futuros que o
 * chat mostra logo antes: curva subindo → "pode valer esperar"; senão → "bom
 * momento pra vender". Sem dado, só descreve o que o sinal cruza (nunca
 * inventa um veredito).
 */
export function fraseDeSinal(f: ExemplosDoDia["futuroSoja"]): string {
  if (!f || f.contratos.length < 2) {
    return "Sinal de venda: cruza o preço de hoje, os últimos 90 dias, o mercado futuro e o clima pra dizer se é hora de vender ou esperar.";
  }
  const primeiro = f.contratos[0]!.valor;
  const ultimo = f.contratos[f.contratos.length - 1]!.valor;
  const sobe = ultimo > primeiro * 1.005;
  return sobe
    ? "Sinal de venda: o mercado futuro aponta alta nos próximos meses. Pode valer esperar um pouco."
    : "Sinal de venda: o mercado futuro não aponta mais alta. Pode ser um bom momento pra vender.";
}

/** Linha de mercado futuro da B3 a partir do dado real (ou null se não houver). */
export function fraseDeFuturo(f: NonNullable<ExemplosDoDia["futuroSoja"]>): string {
  const moeda = f.unidade.toLowerCase().includes("us$") ? "US$ " : "R$ ";
  return f.contratos
    .slice(0, 3)
    .map((c) => `${mesAnoCurto(c.vencimento)} ${moeda}${brl2(c.valor)}`)
    .join(" · ");
}
