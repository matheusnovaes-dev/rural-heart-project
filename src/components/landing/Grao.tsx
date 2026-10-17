import { useEffect } from "react";

import { MIDIA } from "@/assets/midia";

let iniciado = false;

/** Baixa o grão só quando o navegador está ocioso (depois do LCP) e o revela com um fade, para não disputar banda com o hero. */
function carregarGraoQuandoOcioso() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  const iniciar = () => {
    const img = new Image();
    img.src = MIDIA.grao;
    img
      .decode()
      .catch(() => undefined)
      .then(() => {
        const html = document.documentElement;
        html.style.setProperty("--grao-url", `url(${MIDIA.grao})`);
        html.classList.add("grao-ok");
      });
  };
  const ric = (
    window as unknown as {
      requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (ric) ric(iniciar, { timeout: 2500 });
  else window.setTimeout(iniciar, 1500);
}

/**
 * Grão de filme muito sutil sobre as seções escuras (tira o aspecto de tela digital lisa, como no site do Lando Norris).
 * É uma imagem de 7KB repetida, estática, sem animação nem mix-blend (zero custo de CPU e de GPU na rolagem), por isso
 * vale igual no celular e no desktop. Baixa só depois que a página terminou de carregar (ocioso) e aparece com um fade,
 * então não entra na conta do LCP. Fica atrás do texto quando vem antes dele no HTML e não recebe toque.
 */
export function Grao({ className = "" }: { className?: string }) {
  useEffect(() => {
    carregarGraoQuandoOcioso();
  }, []);
  return <span aria-hidden="true" className={`grao ${className}`} />;
}
