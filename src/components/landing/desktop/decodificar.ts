/**
 * Números e rótulos que se "decodificam" quando entram na tela (como os títulos do site do Active Theory): os caracteres
 * embaralham por um instante e travam no valor certo, da esquerda para a direita, como um painel de dados chegando. Combina com
 * a ideia do produto (dado com fonte e data). Só desktop (vem no DesktopFX) e uma vez por elemento.
 *
 * Marcação: `data-decodificar` (só os dígitos embaralham; "R$", vírgulas e espaços ficam parados) ou
 * `data-decodificar="tudo"` (letras também, para rótulos curtos em fonte mono). Use em texto com `tabular-nums`/mono para a
 * largura não tremer. Mexe só no texto dos nós e devolve exatamente o original no fim; se o React trocar o texto no meio, aquele
 * nó é largado como está (nunca sobrescreve um valor novo). Elementos que aparecem depois (seções carregadas sob demanda) são
 * pegos por um MutationObserver.
 */
const DIGITOS = "0123456789";
const MAIUSCULAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijklmnopqrstuvwxyz";
const DURACAO_MS = 750;

const sorteia = (s: string) => s[Math.floor(Math.random() * s.length)]!;

function embaralha(c: string, letras: boolean): string {
  if (c >= "0" && c <= "9") return sorteia(DIGITOS);
  if (!letras) return c;
  if (c.toUpperCase() !== c.toLowerCase())
    return c === c.toUpperCase() ? sorteia(MAIUSCULAS) : sorteia(MINUSCULAS);
  return c;
}

function decodificar(el: HTMLElement, rodando: Set<number>) {
  const letras = el.dataset["decodificar"] === "tudo";
  const nos: { no: Text; original: string; ultimo: string; vivo: boolean }[] = [];
  const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = andar.nextNode(); n; n = andar.nextNode()) {
    const t = n as Text;
    if (t.nodeValue && t.nodeValue.trim())
      nos.push({ no: t, original: t.nodeValue, ultimo: t.nodeValue, vivo: true });
  }
  const total = nos.reduce((s, x) => s + x.original.length, 0);
  if (!total) return;
  const inicio = performance.now();
  let ultimaTroca = 0;
  let raf = 0;
  const passo = (agora: number) => {
    rodando.delete(raf);
    const t = agora - inicio;
    const trocar = agora - ultimaTroca > 45; // troca os caracteres ~22 vezes por segundo (mais rápido vira borrão)
    if (trocar) ultimaTroca = agora;
    let pos = 0;
    let falta = false;
    for (const x of nos) {
      if (!x.vivo) {
        pos += x.original.length;
        continue;
      }
      if (x.no.nodeValue !== x.ultimo) {
        x.vivo = false; // o React mudou o texto: não mexe mais
        pos += x.original.length;
        continue;
      }
      if (!trocar && t < DURACAO_MS) {
        pos += x.original.length;
        falta = true;
        continue;
      }
      let s = "";
      for (let k = 0; k < x.original.length; k++, pos++) {
        const trava = 120 + (pos / total) * (DURACAO_MS - 200); // trava da esquerda para a direita
        const c = x.original[k]!;
        if (t >= trava) s += c;
        else {
          s += embaralha(c, letras);
          falta = true;
        }
      }
      x.no.nodeValue = s;
      x.ultimo = s;
    }
    if (falta && t < DURACAO_MS + 200) {
      raf = requestAnimationFrame(passo);
      rodando.add(raf);
    } else {
      for (const x of nos) if (x.vivo && x.no.nodeValue === x.ultimo) x.no.nodeValue = x.original;
    }
  };
  raf = requestAnimationFrame(passo);
  rodando.add(raf);
}

export function iniciarDecodificar(): () => void {
  const vistos = new WeakSet<Element>();
  const rodando = new Set<number>();
  const io = new IntersectionObserver(
    (entradas) =>
      entradas.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        decodificar(en.target as HTMLElement, rodando);
      }),
    { rootMargin: "0px 0px -8% 0px" },
  );
  const observar = (el: Element) => {
    if (vistos.has(el)) return;
    vistos.add(el);
    io.observe(el);
  };
  document.querySelectorAll("[data-decodificar]").forEach(observar);
  const mo = new MutationObserver((mudancas) =>
    mudancas.forEach((m) =>
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches("[data-decodificar]")) observar(n);
        n.querySelectorAll("[data-decodificar]").forEach(observar);
      }),
    ),
  );
  mo.observe(document.body, { childList: true, subtree: true });
  return () => {
    io.disconnect();
    mo.disconnect();
    rodando.forEach((id) => cancelAnimationFrame(id));
  };
}
