/**
 * Texto dos botões e links que "rola" no hover (o efeito do site do Lando Norris): cada letra sobe e é
 * substituída por uma cópia vinda de baixo, com um pequeno atraso entre uma e outra. Vale para elementos
 * marcados com data-rolar cujo texto é um nó fixo. Se o texto do botão muda (carregando...), o React precisa
 * poder remover o nó: por isso, em botões de conteúdo variável, o data-rolar vai num <span> próprio, que o React
 * remove inteiro. Acessibilidade: as letras ficam aria-hidden e um span sr-only guarda o texto real. Só CSS
 * (transform) no hover e no foco; o estilo só existe no desktop porque este arquivo só é carregado lá. Um
 * MutationObserver aplica o efeito também em botões que aparecem depois (modal de cadastro).
 */
const CSS = `
.fx-roll { display: inline-flex; white-space: pre; }
.fx-l { position: relative; display: inline-block; overflow: hidden; vertical-align: top; height: 1.32em; line-height: 1.32; }
.fx-l > span { display: block; transition: transform .55s cubic-bezier(.22,1,.36,1); transition-delay: calc(var(--i) * 16ms); will-change: transform; }
.fx-l > .b { position: absolute; left: 0; top: 100%; }
[data-rolar]:hover .fx-l > span, [data-rolar]:focus-visible .fx-l > span,
:is(a, button):hover > [data-rolar] .fx-l > span, :is(a, button):focus-visible > [data-rolar] .fx-l > span { transform: translateY(-100%); }
`;

type Feito = { original: Node; troca: HTMLElement; leitor: HTMLElement };

export function iniciarLetrasRolando(): () => void {
  const estilo = document.createElement("style");
  estilo.dataset["fx"] = "letras";
  estilo.textContent = CSS;
  document.head.appendChild(estilo);

  const feitos: Feito[] = [];
  const aplicar = () => {
    document.querySelectorAll<HTMLElement>("[data-rolar]:not([data-rolado])").forEach((el) => {
      const original = Array.from(el.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
      );
      el.dataset["rolado"] = "1";
      if (!original) return;
      const texto = (original.textContent ?? "").replace(/\s+/g, " ");
      const troca = document.createElement("span");
      troca.className = "fx-roll";
      troca.setAttribute("aria-hidden", "true");
      Array.from(texto).forEach((ch, i) => {
        const letra = document.createElement("span");
        letra.className = "fx-l";
        letra.style.setProperty("--i", String(i));
        const a = document.createElement("span");
        a.className = "a";
        a.textContent = ch === " " ? "\u00a0" : ch;
        const b = document.createElement("span");
        b.className = "b";
        b.textContent = a.textContent;
        letra.append(a, b);
        troca.appendChild(letra);
      });
      const leitor = document.createElement("span");
      leitor.className = "sr-only";
      leitor.textContent = texto.trim();
      el.replaceChild(troca, original);
      el.insertBefore(leitor, troca);
      feitos.push({ original, troca, leitor });
    });
  };
  aplicar();

  let pendente = 0;
  const mo = new MutationObserver(() => {
    if (pendente) return;
    pendente = requestAnimationFrame(() => {
      pendente = 0;
      aplicar();
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    if (pendente) cancelAnimationFrame(pendente);
    feitos.forEach(({ original, troca, leitor }) => {
      const pai = troca.parentNode;
      if (pai) {
        pai.replaceChild(original, troca);
        leitor.remove();
        (pai as HTMLElement).removeAttribute?.("data-rolado");
      }
    });
    estilo.remove();
  };
}
