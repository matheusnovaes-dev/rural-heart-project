import postcss, { type AtRule, type Declaration, type Root, type Rule } from "postcss";
import type { Plugin } from "vite";

/**
 * Cores para navegador antigo (Chrome < 111: o último Chrome do Windows 7/8 é o 109; WebView de Android desatualizado).
 * O Tailwind 4 gera as cores em oklch() e as transparências em color-mix(), que esses navegadores não entendem: o botão
 * laranja ficava sem fundo, o escurecimento do hero sumia e o login ficava em branco (testado num Chromium 109 real).
 * Este passo roda no CSS final (depois da minificação, para nada ser "otimizado" de volta) e não muda nada nos
 * navegadores modernos:
 *  1. todo oklch() ganha uma versão sRGB equivalente (croma reduzido se a cor sai do sRGB). Em propriedade comum, a
 *     reserva entra antes da original (o antigo ignora a que não entende). Em variável (--x), a reserva fica no lugar e a
 *     original volta num @supports (color: oklch(...)) logo depois, no mesmo @layer/@media.
 *  2. color-mix(in oklab, COR P%, transparent) vira uma cor com transparência calculada aqui. O Tailwind põe como reserva
 *     a cor CHEIA (`bg-primary/10` virava verde sólido); a reserva passa a ser a mesma cor com 10%.
 */

type Rgba = { r: number; g: number; b: number; a: number };

// ---------------------------------------------------------------- oklch -> sRGB
function oklchParaSrgb(l: number, c: number, h: number): [number, number, number] | null {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3,
    M = m_ ** 3,
    S = s_ ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  const eps = 0.0005;
  if (lin.some((v) => v < -eps || v > 1 + eps)) return null;
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

function oklchEmRgb(l: number, c: number, h: number): [number, number, number] {
  let rgb = oklchParaSrgb(l, c, h);
  if (rgb) return rgb;
  // fora do sRGB: reduz o croma mantendo luminosidade e matiz (como o navegador faz ao mapear a cor)
  let lo = 0,
    hi = c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (oklchParaSrgb(l, mid, h)) lo = mid;
    else hi = mid;
  }
  rgb = oklchParaSrgb(l, lo, h) ?? [l, l, l];
  return rgb;
}

const num = (s: string, escalaPct = 1) =>
  s.trim().endsWith("%") ? (parseFloat(s) / 100) * escalaPct : parseFloat(s);

function lerOklch(dentro: string): Rgba | null {
  const [cor, alfa] = dentro.split("/");
  const partes = cor!.trim().split(/\s+/);
  if (partes.length !== 3 || partes.some((p) => p.includes("var(") || p === "from")) return null;
  const l = num(partes[0]!);
  const c = num(partes[1]!, 0.4);
  const h = partes[2] === "none" ? 0 : parseFloat(partes[2]!);
  if (![l, c, h].every(Number.isFinite)) return null;
  const [r, g, b] = oklchEmRgb(l, c, h);
  const a = alfa ? num(alfa) : 1;
  if (!Number.isFinite(a)) return null;
  return { r: r * 255, g: g * 255, b: b * 255, a };
}

function textoRgba({ r, g, b, a }: Rgba): string {
  const R = Math.round(r),
    G = Math.round(g),
    B = Math.round(b);
  if (a >= 0.999) return "#" + [R, G, B].map((v) => v.toString(16).padStart(2, "0")).join("");
  return `rgba(${R},${G},${B},${+a.toFixed(3)})`;
}

/** Acha o fechamento do parêntese que abre em `i` (com aninhamento). */
function fecha(s: string, i: number): number {
  let n = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") n++;
    else if (s[j] === ")" && --n === 0) return j;
  }
  return -1;
}

/** Troca cada `nome(...)` do texto por `troca(conteúdo)`; se `troca` devolve null, mantém o original. */
function trocarFuncao(
  valor: string,
  nome: string,
  troca: (dentro: string) => string | null,
): string {
  let out = "";
  let i = 0;
  for (;;) {
    const k = valor.indexOf(nome + "(", i);
    if (k < 0) return out + valor.slice(i);
    const ini = k + nome.length;
    const fim = fecha(valor, ini);
    if (fim < 0) return out + valor.slice(i);
    const novo = troca(valor.slice(ini + 1, fim));
    out += valor.slice(i, k) + (novo ?? valor.slice(k, fim + 1));
    i = fim + 1;
  }
}

const NOMEADAS: Record<string, Rgba> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
};

// ---------------------------------------------------------------- plugin
function transformar(root: Root) {
  // Variáveis definidas em :root (a última definição vale), para resolver var(--x) estaticamente.
  const tokens = new Map<string, string>();
  root.walkRules((r) => {
    if (!/(^|,)\s*:root\b/.test(r.selector)) return;
    r.each((n) => {
      if (n.type === "decl" && n.prop.startsWith("--")) tokens.set(n.prop, n.value);
    });
  });

  const resolver = (valor: string, prof = 0): Rgba | null => {
    const v = valor.trim();
    if (prof > 12) return null;
    if (v.startsWith("var(")) {
      const dentro = v.slice(4, fecha(v, 3));
      const virgula = dentro.indexOf(",");
      const nome = (virgula < 0 ? dentro : dentro.slice(0, virgula)).trim();
      const t = tokens.get(nome);
      if (t != null) return resolver(t, prof + 1);
      return virgula < 0 ? null : resolver(dentro.slice(virgula + 1), prof + 1);
    }
    if (v.startsWith("oklch(")) return lerOklch(v.slice(6, fecha(v, 5)));
    if (v.startsWith("color-mix(")) return misturar(v.slice(10, fecha(v, 9)), prof + 1);
    if (/^#[0-9a-f]{3,8}$/i.test(v)) {
      const h =
        v.length <= 5
          ? v
              .slice(1)
              .split("")
              .map((x) => x + x)
              .join("")
          : v.slice(1);
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
    const m = v.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1]!.split(/[\s,/]+/).filter(Boolean);
      return {
        r: num(p[0]!, 255),
        g: num(p[1]!, 255),
        b: num(p[2]!, 255),
        a: p[3] ? num(p[3]) : 1,
      };
    }
    return NOMEADAS[v.toLowerCase()] ?? null;
  };

  // color-mix(in <espaço>, A p%, B q%): mistura simples em sRGB (para reserva basta; o moderno usa o original)
  const misturar = (dentro: string, prof: number): Rgba | null => {
    const partes: string[] = [];
    let n = 0,
      ini = 0;
    for (let j = 0; j < dentro.length; j++) {
      if (dentro[j] === "(") n++;
      else if (dentro[j] === ")") n--;
      else if (dentro[j] === "," && n === 0) {
        partes.push(dentro.slice(ini, j));
        ini = j + 1;
      }
    }
    partes.push(dentro.slice(ini));
    if (partes.length !== 3) return null;
    const lado = (s: string) => {
      const m = s.trim().match(/^(.*?)(?:\s+([\d.]+)%)?$/);
      return { cor: resolver(m![1]!, prof), p: m![2] != null ? parseFloat(m![2]) / 100 : null };
    };
    const A = lado(partes[1]!),
      B = lado(partes[2]!);
    if (!A.cor || !B.cor) return null;
    const pa = A.p ?? (B.p != null ? 1 - B.p : 0.5);
    const pb = B.p ?? 1 - pa;
    const a = A.cor.a * pa + B.cor.a * pb;
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (x: number, y: number) => (x * A.cor!.a * pa + y * B.cor!.a * pb) / a;
    return { r: mix(A.cor.r, B.cor.r), g: mix(A.cor.g, B.cor.g), b: mix(A.cor.b, B.cor.b), a };
  };

  const reservaDe = (valor: string): string => {
    let v = trocarFuncao(valor, "color-mix", (d) => {
      const c = misturar(d, 0);
      return c ? textoRgba(c) : null;
    });
    v = trocarFuncao(v, "oklch", (d) => {
      const c = lerOklch(d);
      return c ? textoRgba(c) : null;
    });
    return v;
  };
  const precisa = (v: string) => v.includes("oklch(") || v.includes("color-mix(");

  // 2. Reservas do Tailwind para color-mix (regra comum seguida de @supports (color: color-mix(...)) com o mesmo
  //    seletor): a reserva vira a cor com a transparência certa, calculada aqui.
  root.walkAtRules("supports", (at: AtRule) => {
    if (!at.params.includes("color-mix")) return;
    const anterior = at.prev();
    if (!anterior || anterior.type !== "rule") return;
    at.walkRules((r) => {
      if (r.selector !== (anterior as Rule).selector) return;
      r.walkDecls((d) => {
        if (!d.value.includes("color-mix(")) return;
        const alvo = (anterior as Rule).nodes.find(
          (n): n is Declaration => n.type === "decl" && n.prop === d.prop,
        );
        if (!alvo) return;
        const reserva = reservaDe(d.value);
        if (!precisa(reserva)) alvo.value = reserva;
      });
    });
  });

  // 1. oklch (e color-mix fora do padrão acima) em qualquer declaração
  const jaGuardado = new WeakMap<Rule, Rule>();
  root.walkDecls((d) => {
    if (!precisa(d.value)) return;
    const pai = d.parent;
    if (!pai || pai.type !== "rule") return;
    // dentro de um @supports de cor moderna, o navegador antigo nem lê: nada a fazer
    let anc = pai.parent;
    while (anc && anc.type !== "root") {
      if (
        anc.type === "atrule" &&
        (anc as AtRule).name === "supports" &&
        /oklch|color-mix/.test((anc as AtRule).params)
      )
        return;
      anc = anc.parent;
    }
    const reserva = reservaDe(d.value);
    if (reserva === d.value) return;
    if (d.prop.startsWith("--")) {
      // variável: a reserva fica no lugar e a original volta num @supports logo depois da regra (mesmo @layer/@media)
      let guarda = jaGuardado.get(pai as Rule);
      if (!guarda) {
        const sup = postcss.atRule({
          name: "supports",
          params: "(color:oklch(0 0 0)) and (color:color-mix(in lab,red,red))",
        });
        guarda = postcss.rule({ selector: (pai as Rule).selector });
        sup.append(guarda);
        pai.after(sup);
        jaGuardado.set(pai as Rule, guarda);
      }
      guarda.append(d.clone());
      d.value = reserva;
    } else {
      d.cloneBefore({ value: reserva });
    }
  });
}

export function coresAntigas(): Plugin {
  return {
    name: "safralume:cores-antigas",
    apply: "build",
    enforce: "post",
    generateBundle(_opts, bundle) {
      for (const arq of Object.values(bundle)) {
        if (arq.type !== "asset" || !arq.fileName.endsWith(".css")) continue;
        const css =
          typeof arq.source === "string" ? arq.source : Buffer.from(arq.source).toString("utf8");
        const root = postcss.parse(css);
        transformar(root);
        arq.source = root.toString();
      }
    },
  };
}

export const __teste = { lerOklch, textoRgba, transformar };
