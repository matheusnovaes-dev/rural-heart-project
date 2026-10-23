import { useEffect, type CSSProperties } from "react";

import { ASSINATURA } from "@/components/landing/assinaturaPath";

const { caixa } = ASSINATURA;
const MARGEM = 120;
const VB = `${caixa.x - MARGEM} ${caixa.y - MARGEM} ${caixa.largura + MARGEM * 2} ${caixa.altura + MARGEM * 2 + 120}`;
const FLORIO = "M 380 250 C 1500 360 2700 250 3190 70";

/** Duração total da abertura (CSS em styles.css usa os mesmos tempos): a cobertura sai entre 2,05 e 2,85s. */
const DURACAO_MS = 2950;
/** Abertura 3D (ramos de luz + assinatura, desktop/introRamos.ts): a cobertura sai entre 3,6 e 4,4s. */
const DURACAO_3D_MS = 4500;

/**
 * Abertura 3D: começa assim que este arquivo é avaliado no navegador (ANTES da hidratação do React), para os ramos aparecerem
 * logo. Enquanto o WebGL não desenha o 1º quadro, o CSS da cobertura fica pausado (classe `intro-3d` sem `intro-3d-rodando`);
 * no 1º quadro tudo corre junto. Se o WebGL falhar ou demorar mais de 1,8s, cai na abertura CSS (tira `intro-3d`).
 */
const estado3d = { comecou: false, caiu: false };
function iniciar3d() {
  const html = document.documentElement;
  const cair = () => {
    if (estado3d.comecou || estado3d.caiu) return;
    estado3d.caiu = true;
    html.classList.remove("intro-3d");
    window.setTimeout(() => html.classList.remove("intro-ativa"), DURACAO_MS);
  };
  window.setTimeout(cair, 1800);
  import("@/components/landing/desktop/introRamos")
    .then((m) => {
      if (estado3d.caiu) return;
      const cobertura = document.querySelector<HTMLElement>(".intro-cobertura");
      const forcar = /[?&]intro=3d/.test(location.search);
      const ok =
        !!cobertura &&
        m.iniciarIntroRamos(
          cobertura,
          () => {
            estado3d.comecou = true;
            html.classList.add("intro-3d-rodando");
            window.setTimeout(() => html.classList.remove("intro-ativa"), DURACAO_3D_MS);
          },
          () => {},
          forcar,
        );
      if (!ok) cair();
    })
    .catch(cair);
}
if (typeof document !== "undefined" && document.documentElement.classList.contains("intro-3d")) {
  iniciar3d();
}

/**
 * Poeira dourada em profundidade (como a abertura do Active Theory): pontos de luz suaves de vários tamanhos que sobem devagar.
 * Só CSS (gradiente radial + transform/opacity, nada de blur nem canvas), no HTML do servidor e SEM aleatório (o servidor e o
 * cliente geram o mesmo DOM). Perto = grande, rápido e mais brilhante; longe = pequeno, lento e fraco.
 */
const POEIRA = Array.from({ length: 38 }, (_, i) => {
  // Gerador só com inteiros (Math.imul): resultado idêntico em qualquer navegador e no servidor, sem divergência na hidratação.
  let x = (i + 1) * 2654435761;
  const r = () => {
    x = Math.imul(x ^ (x >>> 15), 2246822519) ^ Math.imul(x ^ (x >>> 13), 3266489917);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  const profundidade = r(); // 0 longe, 1 perto
  return {
    esquerda: Math.round(r() * 100),
    tamanho: Math.round(5 + profundidade * profundidade * 78),
    duracao: (9 - profundidade * 4.2 + r() * 1.5).toFixed(2),
    atraso: (-r() * 6).toFixed(2),
    brilho: (0.22 + profundidade * 0.55).toFixed(2),
    deriva: Math.round((r() - 0.5) * 120),
    base: Math.round(55 + r() * 55),
  };
});

/**
 * Chave do localStorage que marca a entrada já vista. O script que decide se a entrada roda está no `head` da rota
 * (routes/index.tsx) e usa a MESMA chave.
 */
export const CHAVE_INTRO = "safralume_intro_visto";

/**
 * Entrada da página (a abertura do site do Lando Norris): tela escura da marca e a assinatura "Safralume" se escrevendo,
 * por ~1,6s, só na PRIMEIRA visita e só em desktop de verdade (tela larga, mouse, sem "reduzir movimento", rede e
 * máquina que aguentam). Quem decide é um script minúsculo no `head`, que põe a classe `intro-ativa` no <html> antes da
 * primeira pintura (por isso a abertura não "pisca" a landing por baixo); sem a classe, a cobertura é `display:none`.
 * Toda a animação é CSS e está no HTML do servidor (o contorno da assinatura é o do rodapé, referenciado com <use>): não depende da hidratação do React nem ocupa a thread principal. Se o JS
 * falhar, o próprio CSS esconde a cobertura (animação de segurança). O React só grava que já foi vista e limpa as classes.
 */
export function IntroAssinatura() {
  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains("intro-ativa")) return;
    try {
      localStorage.setItem(CHAVE_INTRO, "1");
    } catch {
      /* navegação privada: tudo bem, só rodaria de novo na próxima visita */
    }
    let encerrada = false;
    const encerrar = () => {
      if (encerrada) return;
      encerrada = true;
      html.classList.remove("intro-ativa");
    };
    const em3d = html.classList.contains("intro-3d");
    // `intro-rodou` fica um pouco mais (a foto do hero ainda "se aproxima") e some, para a animação não repetir ao voltar à página.
    const tFoto = window.setTimeout(
      () => html.classList.remove("intro-rodou"),
      (em3d ? DURACAO_3D_MS + 1500 : DURACAO_MS) + 1800,
    );
    // Na abertura 3D quem encerra é o próprio 3D (a contagem começa no 1º quadro desenhado) ou a queda para o CSS.
    const t = em3d ? 0 : window.setTimeout(encerrar, DURACAO_MS);
    // Quem não quer esperar: qualquer toque, tecla ou rolagem encerra a abertura na hora (a cobertura some em 0,25s).
    const pular = () => {
      if (encerrada) return;
      html.classList.add("intro-pular", "intro-3d-rodando");
      window.setTimeout(encerrar, 260);
    };
    const eventos = ["keydown", "pointerdown", "wheel"] as const;
    for (const e of eventos) window.addEventListener(e, pular, { once: true, passive: true });
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(tFoto);
      for (const e of eventos) window.removeEventListener(e, pular);
    };
  }, []);

  return (
    <div aria-hidden="true" className="intro-cobertura">
      <span className="intro-luz" />
      <span className="intro-grao" />
      <div className="intro-poeira">
        {POEIRA.map((d, i) => (
          <i
            key={i}
            style={
              {
                left: `${d.esquerda}%`,
                width: d.tamanho,
                height: d.tamanho,
                "--dur": `${d.duracao}s`,
                "--atraso": `${d.atraso}s`,
                "--brilho": d.brilho,
                "--deriva": `${d.deriva}px`,
                "--base": `${d.base}vh`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="intro-conteudo">
        <div className="intro-escrita">
          <div className="intro-escreve">
            <svg viewBox={VB} className="intro-svg" style={{ overflow: "visible" }}>
              <defs>
                <linearGradient id="intro-g" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#FFC068" />
                  <stop offset="0.5" stopColor="#E8912A" />
                  <stop offset="1" stopColor="#D9771A" />
                </linearGradient>
              </defs>
              {/* mesmo contorno do rodapé (id="assinatura-d" em AssinaturaSvg): evita repetir o caminho no HTML */}
              <use href="#assinatura-d" />
              <path
                className="intro-florio"
                d={FLORIO}
                pathLength={1}
                fill="none"
                stroke="url(#intro-g)"
                strokeWidth={26}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="intro-caneta" />
        </div>
        <p className="intro-frase">Sempre na hora certa</p>
      </div>
      {/* contador e linha de carregamento (como a abertura do Active Theory), só CSS */}
      <span className="intro-rotulo">Preço com fonte e data</span>
      <span className="intro-contador" />
      <span className="intro-barra" />
    </div>
  );
}
