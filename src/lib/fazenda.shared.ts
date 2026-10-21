/**
 * Caderno da fazenda: tipos, categorias, leitura de números escritos à mão e contas do resumo.
 * Fica fora do bot e do painel porque os dois usam exatamente as mesmas regras (o que é gasto,
 * como se soma, o que é "este mês"). Sem dependência de servidor, para rodar também no navegador.
 */

export const TIPOS_REGISTRO = ["gasto", "venda", "plantio", "colheita", "nota"] as const;
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number];

export const ROTULO_TIPO: Record<TipoRegistro, string> = {
  gasto: "Gasto",
  venda: "Venda",
  plantio: "Plantio",
  colheita: "Colheita",
  nota: "Anotação",
};

export type RegistroFazenda = {
  id: string;
  tipo: TipoRegistro;
  /** AAAA-MM-DD */
  ocorrido_em: string;
  valor: number | null;
  descricao: string;
  categoria: string | null;
  cultura: string | null;
  talhao: string | null;
  quantidade: number | null;
  unidade: string | null;
  preco_unitario: number | null;
  origem: "whatsapp" | "painel";
  criado_em: string;
};

/** Categorias de gasto (a lista que o painel oferece e que o bot escolhe sozinho pelo texto). */
export const CATEGORIAS_GASTO = [
  "Adubo e corretivos",
  "Sementes e mudas",
  "Defensivos",
  "Combustível",
  "Mão de obra",
  "Máquinas e manutenção",
  "Frete e transporte",
  "Energia e água",
  "Arrendamento",
  "Animais e sanidade",
  "Impostos e taxas",
  "Outros",
] as const;

const SEM_ACENTO = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const REGRAS_CATEGORIA: [RegExp, (typeof CATEGORIAS_GASTO)[number]][] = [
  [
    /\b(adub\w*|fertiliz\w*|calcario|calagem|gesso|ureia|npk|fosfat\w*|potassio|cloreto de potassio)\b/,
    "Adubo e corretivos",
  ],
  [/\b(semente\w*|muda\w*|plantio de muda)\b/, "Sementes e mudas"],
  [
    /\b(defensiv\w*|veneno|herbicid\w*|fungicid\w*|inseticid\w*|agrotoxic\w*|dessec\w*|glifosato|aplicacao)\b/,
    "Defensivos",
  ],
  [/\b(diesel|combustivel|gasolina|oleo diesel|abastec\w*)\b/, "Combustível"],
  [
    /\b(mao de obra|diaria\w*|salario\w*|funcionario\w*|empregad\w*|pedreiro|peao|vaqueiro|tratorista|13o|ferias|inss|fgts)\b/,
    "Mão de obra",
  ],
  [
    /\b(manutencao|conserto|reparo|peca\w*|pneu\w*|trator\w*|colheitadeira|pulverizador|implemento\w*|oficina|mecanico)\b/,
    "Máquinas e manutenção",
  ],
  [/\b(frete|transporte|caminhao|carreto)\b/, "Frete e transporte"],
  [/\b(energia|luz|conta de luz|irrigacao|agua|poco)\b/, "Energia e água"],
  [/\b(arrendamento|arrendei|aluguel de terra|aluguel da terra)\b/, "Arrendamento"],
  [
    /\b(racao|sal mineral|vacina\w*|vermifug\w*|veterinari\w*|medicamento\w*|remedio\w* do gado|suplemento|silagem|gado|bezerro\w*)\b/,
    "Animais e sanidade",
  ],
  [/\b(imposto\w*|itr|funrural|taxa\w*|seguro|licenca|financiamento|juros)\b/, "Impostos e taxas"],
];

/** Categoria de gasto adivinhada pelo texto ("adubo no talhão 3" -> Adubo e corretivos). */
export function categoriaDeTexto(texto: string): (typeof CATEGORIAS_GASTO)[number] {
  const t = SEM_ACENTO(texto);
  for (const [re, cat] of REGRAS_CATEGORIA) if (re.test(t)) return cat;
  return "Outros";
}

/** Aceita a categoria que o modelo mandou só se for uma das nossas; senão adivinha pelo texto. */
export function categoriaValida(categoria: string | null | undefined, descricao: string): string {
  const achada = CATEGORIAS_GASTO.find((c) => c === categoria);
  // "Outros" do modelo não vale mais que a palavra-chave ("comprei um trator" é máquina)
  if (achada && achada !== "Outros") return achada;
  const pelaPalavra = categoriaDeTexto(`${categoria ?? ""} ${descricao}`);
  return pelaPalavra === "Outros" && achada ? achada : pelaPalavra;
}

// ---------------------------------------------------------------------------------------------
// Números escritos à mão
// ---------------------------------------------------------------------------------------------

function paraNumero(bruto: string): number | null {
  let s = bruto;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
  else if (/^\d+\.\d{3}$/.test(s)) s = s.replace(".", "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Todos os números que a pessoa escreveu, já em valor (12 mil -> 12000, 1,5 mil -> 1500,
 * R$ 12.000,50 -> 12000.5, 3 mil e 500 -> 3500). Serve para conferir, por código, que o valor que o
 * modelo mandou gravar está de fato na mensagem (modelo erra "12 mil" vira 12 e esse erro entraria no
 * caderno do produtor para sempre).
 */
export function numerosDoTexto(texto: string): number[] {
  const t = SEM_ACENTO(texto).replace(/r\$\s*/g, "");
  const achados = new Set<number>();
  const re =
    /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?:\s*(mil|k|milhoes|milhao)\b(?:\s+e\s+(meio|\d{1,3})\b)?)?/g;
  for (const m of t.matchAll(re)) {
    const base = paraNumero(m[1]!);
    if (base === null) continue;
    const mult = m[2] === "mil" || m[2] === "k" ? 1000 : m[2] ? 1_000_000 : 1;
    let n = base * mult;
    if (m[3] && mult > 1) n += m[3] === "meio" ? mult / 2 : Number(m[3]);
    achados.add(Math.round(n * 100) / 100);
  }
  return [...achados];
}

export function valorConfere(valor: number, numeros: number[]): boolean {
  return numeros.some((n) => Math.abs(n - valor) <= Math.max(0.01, Math.abs(valor) * 0.002));
}

// ---------------------------------------------------------------------------------------------
// Datas e dinheiro
// ---------------------------------------------------------------------------------------------

/** AAAA-MM-DD de hoje em Brasília. */
export function hojeBrasilia(agora: Date = new Date()): string {
  const brt = new Date(agora.getTime() - 3 * 3600_000);
  return brt.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function dataLonga(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const MESES = [
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

export type PeriodoCaderno = "mes" | "mes_passado" | "safra" | "ano" | "tudo";

export function intervaloDoPeriodo(
  periodo: PeriodoCaderno,
  hoje: string = hojeBrasilia(),
): { desde: string; ate: string; rotulo: string } {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (periodo) {
    case "mes":
      return { desde: `${a}-${pad(m)}-01`, ate: hoje, rotulo: `${MESES[m - 1]}/${a}` };
    case "mes_passado": {
      const ma = m === 1 ? a - 1 : a;
      const mm = m === 1 ? 12 : m - 1;
      const ultimo = somarDias(`${a}-${pad(m)}-01`, -1);
      return { desde: `${ma}-${pad(mm)}-01`, ate: ultimo, rotulo: `${MESES[mm - 1]}/${ma}` };
    }
    case "safra": {
      // Safra brasileira: de 1º de setembro a 31 de agosto.
      const ini = m >= 9 ? a : a - 1;
      return {
        desde: `${ini}-09-01`,
        ate: hoje,
        rotulo: `safra ${ini}/${String(ini + 1).slice(2)}`,
      };
    }
    case "ano":
      return { desde: `${a}-01-01`, ate: hoje, rotulo: String(a) };
    default:
      return { desde: "2000-01-01", ate: hoje, rotulo: "tudo que foi lançado" };
  }
}

export function formatarReais(n: number): string {
  const inteiro = Math.abs(n - Math.round(n)) < 0.005;
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatarQuantidade(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------------------------

export type ResumoCaderno = {
  gastos: number;
  vendas: number;
  /** vendas menos gastos, só do que foi lançado */
  resultado: number;
  nGastos: number;
  nVendas: number;
  porCategoria: { categoria: string; total: number; n: number }[];
  porCultura: {
    cultura: string;
    gasto: number;
    venda: number;
    quantidadeVendida: number;
    unidadeVenda: string | null;
    precoMedioVenda: number | null;
  }[];
  plantios: RegistroFazenda[];
  colheitas: RegistroFazenda[];
  nNotas: number;
  /** mais recentes primeiro */
  ultimos: RegistroFazenda[];
};

const porRecencia = (a: RegistroFazenda, b: RegistroFazenda) =>
  b.ocorrido_em.localeCompare(a.ocorrido_em) || b.criado_em.localeCompare(a.criado_em);

export function resumir(registros: RegistroFazenda[]): ResumoCaderno {
  const ordenados = [...registros].sort(porRecencia);
  let gastos = 0;
  let vendas = 0;
  let nGastos = 0;
  let nVendas = 0;
  const cat = new Map<string, { total: number; n: number }>();
  const cult = new Map<
    string,
    { gasto: number; venda: number; qtd: number; valorComQtd: number; unidade: string | null }
  >();
  for (const r of ordenados) {
    const chave = r.cultura ?? "Geral";
    const c = cult.get(chave) ?? { gasto: 0, venda: 0, qtd: 0, valorComQtd: 0, unidade: null };
    if (r.tipo === "gasto" && r.valor !== null) {
      gastos += r.valor;
      nGastos++;
      const k = r.categoria ?? "Outros";
      const x = cat.get(k) ?? { total: 0, n: 0 };
      x.total += r.valor;
      x.n++;
      cat.set(k, x);
      c.gasto += r.valor;
    } else if (r.tipo === "venda" && r.valor !== null) {
      vendas += r.valor;
      nVendas++;
      c.venda += r.valor;
      if (r.quantidade) {
        c.qtd += r.quantidade;
        c.valorComQtd += r.valor;
        c.unidade ??= r.unidade;
      }
    }
    cult.set(chave, c);
  }
  return {
    gastos,
    vendas,
    resultado: vendas - gastos,
    nGastos,
    nVendas,
    porCategoria: [...cat.entries()]
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => b.total - a.total),
    porCultura: [...cult.entries()]
      .filter(([, v]) => v.gasto > 0 || v.venda > 0)
      .map(([cultura, v]) => ({
        cultura,
        gasto: v.gasto,
        venda: v.venda,
        quantidadeVendida: v.qtd,
        unidadeVenda: v.unidade,
        precoMedioVenda: v.qtd > 0 ? v.valorComQtd / v.qtd : null,
      }))
      .sort((a, b) => b.gasto + b.venda - (a.gasto + a.venda)),
    plantios: ordenados.filter((r) => r.tipo === "plantio"),
    colheitas: ordenados.filter((r) => r.tipo === "colheita"),
    nNotas: ordenados.filter((r) => r.tipo === "nota").length,
    ultimos: ordenados.slice(0, 5),
  };
}

/** Linha curta de um lançamento, igual no WhatsApp e no painel. */
export function descreverRegistro(r: RegistroFazenda): string {
  const onde = r.talhao ? `, ${r.talhao}` : "";
  const de = r.cultura ? ` de ${r.cultura.toLowerCase()}` : "";
  const qtd =
    r.quantidade !== null && r.unidade ? `${formatarQuantidade(r.quantidade)} ${r.unidade}` : null;
  switch (r.tipo) {
    case "gasto":
      return `${dataCurta(r.ocorrido_em)}  Gasto de ${formatarReais(r.valor ?? 0)}: ${r.descricao}${onde}`;
    case "venda": {
      const preco = r.preco_unitario ? ` a ${formatarReais(r.preco_unitario)}` : "";
      return `${dataCurta(r.ocorrido_em)}  Venda${de}: ${formatarReais(r.valor ?? 0)}${
        qtd ? ` (${qtd}${preco})` : ""
      }`;
    }
    case "plantio":
      return `${dataCurta(r.ocorrido_em)}  Plantio${de}${qtd ? `, ${qtd}` : ""}${onde}`;
    case "colheita":
      return `${dataCurta(r.ocorrido_em)}  Colheita${de}${qtd ? `, ${qtd}` : ""}${onde}`;
    default:
      return `${dataCurta(r.ocorrido_em)}  ${r.descricao}`;
  }
}
