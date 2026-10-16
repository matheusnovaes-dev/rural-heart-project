import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { MAPA_BRASIL } from "@/components/landing/mapaBrasilPath";
import { useDesktopFino } from "@/components/landing/desktop/useDesktopFino";

const { altura, largura, pais, pinos, ufs } = MAPA_BRASIL;
const ORDEM_PINOS = ["MT", "GO", "MS", "PR", "RS", "SC", "SP", "MG", "BA"] as const;

/**
 * Mapa do Brasil que se DESENHA conforme a página rola, como pano de fundo de um trecho da landing (o contorno oficial
 * do IBGE, simplificado para ~3 KB). Fica sempre atrás do conteúdo, sem receber toque, em traço fino e clareado nas
 * bordas do bloco para nunca competir com o texto. Ao final os estados onde temos preço acendem, um a um.
 * Celular: só o contorno e os pontos (uma coluna de SVG, nenhum cálculo por quadro além do traço).
 * Desktop com mouse e máquina boa (hook useDesktopFino, depois do carregamento): divisas dos 27 estados, siglas e uma
 * faísca que acompanha a ponta do traço. Quem prefere menos movimento vê o mapa inteiro, parado.
 */
export function MapaBrasilFundo({ children }: { children: ReactNode }) {
  const alvo = useRef<HTMLDivElement>(null);
  const detalhado = useDesktopFino();
  const { scrollYProgress: p } = useScroll({ target: alvo, offset: ["start 0.9", "end 0.45"] });

  return (
    <div ref={alvo} className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 bottom-[16%] z-0 overflow-clip max-lg:bottom-[26%]"
      >
        <div className="sticky top-[6vh] flex h-[88vh] justify-center lg:justify-end lg:pr-[1vw]">
          <Mapa p={p} detalhado={detalhado} />
        </div>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Mapa({ p, detalhado }: { p: MotionValue<number>; detalhado: boolean }) {
  const contorno = useTransform(p, [0.02, 0.6], [0, 1]);
  const divisas = useTransform(p, [0.4, 0.85], [0, 1]);
  const faisca = useRef<SVGGElement>(null);
  const paisRef = useRef<SVGPathElement>(null);

  // A faísca anda sobre o contorno (só no desktop detalhado): lê a posição na linha uma vez por mudança de scroll.
  useMotionValueEvent(contorno, "change", (v) => {
    const el = paisRef.current;
    const f = faisca.current;
    if (!el || !f) return;
    if (v <= 0.01 || v >= 0.995) {
      f.style.opacity = "0";
      return;
    }
    const pt = el.getPointAtLength(el.getTotalLength() * v);
    f.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    f.style.opacity = "1";
  });

  return (
    <svg
      viewBox={`-20 -20 ${largura + 40} ${altura + 40}`}
      className="h-full w-auto max-w-none opacity-100 [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_86%,transparent)] max-lg:opacity-80 lg:[mask-image:radial-gradient(ellipse_80%_80%_at_68%_50%,#000_42%,transparent_100%)]"
    >
      {detalhado ? (
        <motion.path
          d={ufs}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity={0.24}
          strokeWidth={1.1}
          strokeLinejoin="round"
          style={{ pathLength: divisas }}
          className="motion-reduce:[stroke-dasharray:none]!"
        />
      ) : null}
      <motion.path
        ref={paisRef}
        d={pais}
        fill="none"
        stroke="var(--primary)"
        strokeOpacity={0.42}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ pathLength: contorno }}
        className="motion-reduce:[stroke-dasharray:none]!"
      />
      {ORDEM_PINOS.map((uf, i) => (
        <Pino
          key={uf}
          uf={uf}
          x={pinos[uf][0]}
          y={pinos[uf][1]}
          p={p}
          de={0.68 + i * 0.03}
          rotulo={detalhado}
        />
      ))}
      {detalhado ? (
        <g ref={faisca} style={{ opacity: 0 }}>
          <circle r={16} fill="#E8912A" opacity={0.25} />
          <circle r={5} fill="#E8912A" />
        </g>
      ) : null}
    </svg>
  );
}

function Pino({
  uf,
  x,
  y,
  p,
  de,
  rotulo,
}: {
  uf: string;
  x: number;
  y: number;
  p: MotionValue<number>;
  de: number;
  rotulo: boolean;
}) {
  const aparece = useTransform(p, [de, de + 0.05], [0, 1]);
  return (
    <motion.g style={{ opacity: aparece }} className="motion-reduce:opacity-100!">
      <circle cx={x} cy={y} r={15} fill="#E8912A" opacity={0.18} className="mapa-pino-pulso" />
      <circle cx={x} cy={y} r={5.5} fill="#E8912A" />
      {rotulo ? (
        <text
          x={x + 12}
          y={y - 11}
          fontSize={20}
          fontWeight={700}
          letterSpacing={1.5}
          fill="var(--primary)"
          fillOpacity={0.55}
          fontFamily="var(--font-mono)"
        >
          {uf}
        </text>
      ) : null}
    </motion.g>
  );
}
