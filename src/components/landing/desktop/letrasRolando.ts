/**
 * Texto dos botões e links que "rola" no hover (o efeito do site do Lando Norris): cada letra sobe e é
 * substituída por uma cópia vinda de baixo, com um pequeno atraso entre uma e outra. Só vale para elementos
 * marcados com data-rolar e de texto fixo (o nó de texto é trocado por letras). Acessibilidade: as letras ficam
 * aria-hidden e o elemento ganha aria-label com o texto original. É só CSS (transform), ativado no hover e no
 * foco do teclado; o estilo só existe no desktop porque este arquivo só é carregado lá.
 */
const CSS = `
.fx-roll { display: inline-flex; white-space: pre; }
.fx-l { position: relative; display: inline-block; overflow: hidden; vertical-align: top; height: 1.32em; line-height: 1.32; }
.fx-l > span { display: block; transition: transform .55s cubic-bezier(.22,1,.36,1); transition-delay: calc(var(--i) * 16ms); will-change: transform; }
.fx-l > .b { position: absolute; left: 0; top: 100%; }
[data-rolar]:hover .fx-l > span, [data-rolar]:focus-visible .fx-l > span { transform: translateY(-100%); }
`;

export function iniciarLetrasRolando(): () => void {
  const estilo = document.createElement("style");
  estilo.dataset["fx"] = "letras";
  estilo.textContent = CSS;
  document.head.appendChild(estilo);

  const feitos: Array<{ el: HTMLElement; original: Node; troca: HTMLElement; rotulou: boolean }> =
    [];
  document.querySelectorAll<HTMLElement>("[data-rolar]").forEach((el) => {
    const original = Array.from(el.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
    );
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
      a.textContent = ch === " " ? " " : ch;
      const b = document.createElement("span");
      b.className = "b";
      b.textContent = a.textContent;
      letra.append(a, b);
      troca.appendChild(letra);
    });
    const rotulou = !el.hasAttribute("aria-label");
    if (rotulou) el.setAttribute("aria-label", texto.trim());
    el.replaceChild(troca, original);
    feitos.push({ el, original, troca, rotulou });
  });

  return () => {
    feitos.forEach(({ el, original, troca, rotulou }) => {
      if (troca.parentNode === el) el.replaceChild(original, troca);
      if (rotulou) el.removeAttribute("aria-label");
    });
    estilo.remove();
  };
}
