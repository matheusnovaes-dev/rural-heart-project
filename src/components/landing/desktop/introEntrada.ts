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
      window.setTimeout(() => html.classList.remove("intro-ativa"), DURACAO_INTRO_3D_MS);
    },
    () => {},
    forcar,
  );
  if (!ok) w.__introCair?.();
}
comecar();
