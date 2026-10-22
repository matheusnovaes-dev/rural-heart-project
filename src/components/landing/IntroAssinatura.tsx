import { useEffect } from "react";

import { ASSINATURA } from "@/components/landing/assinaturaPath";

const { caixa } = ASSINATURA;
const MARGEM = 120;
const VB = `${caixa.x - MARGEM} ${caixa.y - MARGEM} ${caixa.largura + MARGEM * 2} ${caixa.altura + MARGEM * 2 + 120}`;
const FLORIO = "M 380 250 C 1500 360 2700 250 3190 70";

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
    const t = window.setTimeout(() => html.classList.remove("intro-ativa"), 1900);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div aria-hidden="true" className="intro-cobertura">
      <div className="intro-conteudo">
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
        <p className="intro-frase">Sempre na hora certa</p>
      </div>
      {/* contador e linha de carregamento (como a abertura do Active Theory), só CSS */}
      <span className="intro-contador" />
      <span className="intro-barra" />
    </div>
  );
}
