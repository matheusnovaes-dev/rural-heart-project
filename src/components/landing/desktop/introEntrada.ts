import { TINTA } from "../aberturaTinta";

/**
 * Pacote SEPARADO da abertura "caneta de tinta" (public/intro/abertura-*.js, gerado por `bun run build:intro`). O script do
 * head (routes/index.tsx) só injeta este arquivo no desktop, na 1ª visita: o celular nunca baixa os desenhos (~34 KB).
 *
 * Uma linha de tinta dourada desenha espigas de trigo em caligrafia (pena chata: grosso/fino) e flui até o começo do "S" da
 * assinatura; a assinatura se escreve (SVG do React, IntroAssinatura); o sublinhado continua a linha e desenha as espigas do
 * outro lado. Depois a cena esquenta e se dissolve na foto do hero, e a assinatura voa até o nome do cabeçalho.
 * Desenho: contorno com espessura de pena revelado por uma máscara que percorre a linha central (aberturaTinta.ts).
 *
 * O SVG da tinta fica FORA da árvore do React (no fim do <body>, posição fixa sobre o SVG da assinatura, com o mesmo viewBox e
 * overflow visível): mexer no DOM do React antes da hidratação faria ele refazer a página. Se algo falhar, `__introCair`
 * (definido no head) cai na abertura CSS simples.
 */
const DURACAO_MS = 3050;

type Estado = { comecou: boolean; caiu: boolean };
const w = window as Window & { __intro3d?: Estado; __introCair?: () => void };
const html = document.documentElement;
const estado = (w.__intro3d ??= { comecou: false, caiu: false });

function montarTinta(svgAssinatura: SVGSVGElement): SVGSVGElement {
  const r = svgAssinatura.getBoundingClientRect();
  const vb = svgAssinatura.getAttribute("viewBox") ?? "0 0 100 100";
  const parte = (n: 1 | 2, p: { contorno: string; centro: string }) => `
    <mask id="tinta-m${n}" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="11000" height="7000">
      <path class="tinta-traco tinta-${n}" d="${p.centro}" pathLength="1"/>
    </mask>`;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", vb);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "intro-tinta-svg");
  svg.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="tinta-g" gradientUnits="userSpaceOnUse" x1="-1500" y1="-1100" x2="4700" y2="1700">
        <stop offset="0" stop-color="#FFC874"/><stop offset="0.5" stop-color="#EFA243"/><stop offset="1" stop-color="#DE8222"/>
      </linearGradient>
      ${parte(1, TINTA.esquerda)}${parte(2, TINTA.direita)}
      <filter id="tinta-b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <path d="${TINTA.esquerda.contorno}" fill="url(#tinta-g)" mask="url(#tinta-m1)"/>
    <path d="${TINTA.direita.contorno}" fill="url(#tinta-g)" mask="url(#tinta-m2)"/>
    <g filter="url(#tinta-b)">
      <path class="tinta-ponta tinta-1" d="${TINTA.esquerda.centro}" pathLength="1"/>
      <path class="tinta-ponta tinta-2" d="${TINTA.direita.centro}" pathLength="1"/>
    </g>`;
  return svg;
}

/**
 * No fim a assinatura encolhe e voa até o nome "Safralume" do cabeçalho (e some ao chegar): continuidade em vez de corte.
 * Grava deslocamento e escala reais em variáveis CSS do SVG (styles.css, `intro-voa`). O texto da assinatura ocupa 93,07% da
 * largura do SVG e tem o centro a 46,13% da altura (viewBox com margens).
 */
function medirVoo() {
  const svg = document.querySelector<SVGSVGElement>(".intro-svg");
  const alvo = document.querySelector<HTMLElement>("header a[href='/'] span");
  if (!svg || !alvo) return;
  const a = svg.getBoundingClientRect();
  const b = alvo.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const largTexto = a.width * 0.9307;
  const cx = a.left + a.width / 2;
  const cy = a.top + a.height * 0.4613;
  const escala = (b.width / largTexto) * 1.15;
  svg.style.setProperty("--voa-x", `${Math.round(b.left + b.width / 2 - cx)}px`);
  svg.style.setProperty("--voa-y", `${Math.round(b.top + b.height / 2 - cy)}px`);
  svg.style.setProperty("--voa-s", escala.toFixed(3));
}

function comecar() {
  if (estado.caiu || !html.classList.contains("intro-tinta")) return;
  // o SVG da assinatura precisa existir (e o <body>, onde vai a tinta): se o HTML ainda não chegou lá, espera o próximo quadro
  const svgAssinatura = document.querySelector<SVGSVGElement>(".intro-svg");
  if (!document.body || !svgAssinatura || !svgAssinatura.getBoundingClientRect().width) {
    requestAnimationFrame(comecar);
    return;
  }
  try {
    const tinta = montarTinta(svgAssinatura);
    document.body.appendChild(tinta);
    estado.comecou = true;
    html.classList.add("intro-tinta-pronta");
    window.setTimeout(medirVoo, 1400);
    window.setTimeout(() => html.classList.remove("intro-ativa"), DURACAO_MS);
    // a abertura acabou por qualquer motivo (tempo, pulo, segurança do head): tira a tinta da página
    const obs = new MutationObserver(() => {
      if (html.classList.contains("intro-ativa")) return;
      obs.disconnect();
      // pulou: já sumiu em 0,25s, sai na hora; fim normal: espera o último quadro da dissolução
      if (html.classList.contains("intro-pular")) tinta.remove();
      else window.setTimeout(() => tinta.remove(), 300);
    });
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
  } catch {
    w.__introCair?.();
  }
}
comecar();
