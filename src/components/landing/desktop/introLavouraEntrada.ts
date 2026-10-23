import { DURACAO_LAVOURA_MS, iniciarIntroLavoura } from "./introLavoura";

/**
 * Ponto de entrada do pacote SEPARADO da abertura 3D (public/intro/lavoura-*.js, gerado por `bun run build:intro`). O script do
 * head (routes/index.tsx) injeta este arquivo assim que decide que a abertura 3D roda: o download começa junto com o HTML, sem
 * esperar o resto do site carregar nem o React hidratar (antes ele só começava depois de tudo, e a semente ficava parada ~1s).
 * Quem cai na abertura CSS (3D demorou, falhou ou não há WebGL) é `window.__introCair`, definido no próprio head.
 */
type Estado = { comecou: boolean; caiu: boolean };
const w = window as Window & { __intro3d?: Estado; __introCair?: () => void };
const html = document.documentElement;
const estado = (w.__intro3d ??= { comecou: false, caiu: false });

function comecar() {
  if (estado.caiu || !html.classList.contains("intro-3d")) return;
  // o canvas vai no <body>: se o HTML ainda não chegou até lá, espera o próximo quadro
  if (!document.body) {
    requestAnimationFrame(comecar);
    return;
  }
  const forcar = /[?&]intro=3d/.test(location.search);
  const ok = iniciarIntroLavoura(() => {
    estado.comecou = true;
    html.classList.add("intro-3d-rodando");
    window.setTimeout(() => html.classList.remove("intro-ativa"), DURACAO_LAVOURA_MS);
  }, forcar);
  if (!ok) w.__introCair?.();
}
comecar();
