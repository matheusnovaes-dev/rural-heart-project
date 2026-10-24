import { DURACAO_INTRO_3D_MS, iniciarIntroRamos } from "./introRamos";

/**
 * Ponto de entrada do pacote SEPARADO da abertura com ramos (public/intro/abertura-*.js, gerado por `bun run build:intro`). O
 * script do head (routes/index.tsx) injeta este arquivo assim que decide que a abertura em WebGL roda: o download começa junto
 * com o HTML, sem esperar o resto do site nem o React hidratar. Quem cai na abertura CSS (WebGL demorou, falhou ou não existe)
 * é `window.__introCair`, definido no próprio head.
 */
type Estado = { comecou: boolean; caiu: boolean };
const w = window as Window & { __intro3d?: Estado; __introCair?: () => void };
const html = document.documentElement;
const estado = (w.__intro3d ??= { comecou: false, caiu: false });

/**
 * No fim da abertura a assinatura encolhe e voa até o nome "Safralume" do cabeçalho (e some ao chegar, revelando o logo de
 * verdade): continuidade em vez de corte. Calcula deslocamento e escala reais e grava em variáveis CSS do SVG
 * (styles.css, `intro-voa`). Sem o cabeçalho na tela, fica o valor padrão (encolhe e sobe um pouco).
 * O texto da assinatura ocupa 93,07% da largura do SVG e tem o centro a 46,13% da altura (viewBox com margens).
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
  // a assinatura é cursiva e mais "alta": um pouco maior que o nome do cabeçalho fica mais natural ao cruzar
  const escala = (b.width / largTexto) * 1.15;
  svg.style.setProperty("--voa-x", `${Math.round(b.left + b.width / 2 - cx)}px`);
  svg.style.setProperty("--voa-y", `${Math.round(b.top + b.height / 2 - cy)}px`);
  svg.style.setProperty("--voa-s", escala.toFixed(3));
}

function comecar() {
  if (estado.caiu || !html.classList.contains("intro-3d")) return;
  // o canvas vai no <body> e a cobertura precisa existir: se o HTML ainda não chegou lá, espera o próximo quadro
  const cobertura = document.querySelector<HTMLElement>(".intro-cobertura");
  if (!document.body || !cobertura) {
    requestAnimationFrame(comecar);
    return;
  }
  const forcar = /[?&]intro=3d/.test(location.search);
  const ok = iniciarIntroRamos(
    cobertura,
    () => {
      estado.comecou = true;
      html.classList.add("intro-3d-rodando");
      // perto do fim (a página já está toda montada), mede para onde a assinatura voa
      window.setTimeout(medirVoo, 1500);
      window.setTimeout(() => html.classList.remove("intro-ativa"), DURACAO_INTRO_3D_MS);
    },
    () => {},
    forcar,
  );
  if (!ok) w.__introCair?.();
}
comecar();
