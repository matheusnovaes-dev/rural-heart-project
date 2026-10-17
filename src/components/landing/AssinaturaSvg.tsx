import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { ASSINATURA } from "@/components/landing/assinaturaPath";

const { caixa, centros, d } = ASSINATURA;
const MARGEM = 120;
const VB = `${caixa.x - MARGEM} ${caixa.y - MARGEM} ${caixa.largura + MARGEM * 2} ${caixa.altura + MARGEM * 2 + 120}`;
const FLORIO = "M 380 250 C 1500 360 2700 250 3190 70";
const DURACAO_LETRAS = 2800;
const DURACAO_FLORIO = 900;

const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Altura (y) em que a "caneta" está para uma dada posição x: acompanha o centro de cada letra. */
function yDaCaneta(x: number) {
  const pts = centros as readonly (readonly number[])[];
  if (x <= pts[0]![0]!) return pts[0]![1]!;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (x <= b[0]!) return a[1]! + ((b[1]! - a[1]!) * (x - a[0]!)) / (b[0]! - a[0]!);
  }
  return pts[pts.length - 1]![1]!;
}

/**
 * "Safralume" como assinatura (contornos vetoriais da fonte Mea Culpa, em laranja da marca) que se ESCREVE quando
 * `ativo` vira verdadeiro: uma borda inclinada (como a inclinação da letra) varre da esquerda para a direita
 * revelando as letras, uma faísca acompanha a ponta da "caneta" e depois o floreio sob o nome se desenha até uma
 * última cintilada. Tudo em SVG (poucos KB, sem imagem), acionado uma única vez. Quem prefere menos movimento vê a
 * assinatura pronta. O arquivo original em PNG tinha 2,3 MB e a palavra escrita sem o "r"; esta versão é vetorial.
 */
export function AssinaturaSvg({ ativo, className }: { ativo: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const reduz = useReducedMotion();
  const [prog, setProg] = useState(0); // 0..1 das letras
  const [florio, setFlorio] = useState(0); // 0..1 do floreio
  const florioRef = useRef<SVGPathElement>(null);
  const [comprimento, setComprimento] = useState(3000);

  useEffect(() => {
    if (florioRef.current) setComprimento(florioRef.current.getTotalLength());
  }, []);

  useEffect(() => {
    if (!ativo) return;
    if (reduz) {
      setProg(1);
      setFlorio(1);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const passo = (agora: number) => {
      const t = agora - t0;
      setProg(suave(clamp01(t / DURACAO_LETRAS)));
      setFlorio(suave(clamp01((t - DURACAO_LETRAS + 150) / DURACAO_FLORIO)));
      if (t < DURACAO_LETRAS + DURACAO_FLORIO + 100) raf = requestAnimationFrame(passo);
      else {
        setProg(1);
        setFlorio(1);
      }
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [ativo, reduz]);

  const x0 = caixa.x - 420;
  const larguraTotal = caixa.largura + 840;
  const X = x0 + larguraTotal * prog;
  const topo = caixa.y - 200;
  const base = caixa.y + caixa.altura + 200;
  const poligono = `${x0 - 200},${topo} ${X + 300},${topo} ${X - 300},${base} ${x0 - 200},${base}`;
  const escrevendo = prog > 0 && prog < 1;
  const caneta =
    florio > 0 && florio < 1
      ? null
      : { x: X - 120, y: yDaCaneta(Math.min(X - 120, caixa.x + caixa.largura)) };
  // ponta do floreio
  const florioFim =
    florioRef.current && florio > 0
      ? florioRef.current.getPointAtLength(comprimento * florio)
      : null;

  return (
    <svg
      viewBox={VB}
      aria-hidden="true"
      className={className}
      style={{ filter: "drop-shadow(0 6px 22px rgba(232,145,42,.38))", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFC068" />
          <stop offset="0.5" stopColor="#E8912A" />
          <stop offset="1" stopColor="#D9771A" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <polygon points={poligono} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        {/* id fixo: a abertura da página (IntroAssinatura) reaproveita este mesmo contorno com <use>, sem repetir os 10KB */}
        <path id="assinatura-d" d={d} fill={`url(#${id}g)`} />
      </g>
      <path
        ref={florioRef}
        d={FLORIO}
        fill="none"
        stroke={`url(#${id}g)`}
        strokeWidth={26}
        strokeLinecap="round"
        strokeDasharray={comprimento}
        strokeDashoffset={comprimento * (1 - florio)}
        opacity={florio > 0 ? 1 : 0}
      />
      {escrevendo && caneta ? <Faisca x={caneta.x} y={caneta.y} tam={1} /> : null}
      {florioFim && florio < 1 ? <Faisca x={florioFim.x} y={florioFim.y} tam={1} /> : null}
      <g style={{ opacity: florio >= 1 ? 1 : 0 }} className="motion-reduce:opacity-100!">
        <Faisca x={3190} y={70} tam={1.6} piscando />
      </g>
    </svg>
  );
}

function Faisca({
  x,
  y,
  tam,
  piscando,
}: {
  x: number;
  y: number;
  tam: number;
  piscando?: boolean;
}) {
  const r = 70 * tam;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={piscando ? "assinatura-pisca" : undefined}>
        <circle r={r * 1.6} fill="#FFD9A0" opacity={0.28} />
        <path
          d={`M0 ${-r * 1.5} L${r * 0.22} ${-r * 0.22} L${r * 1.5} 0 L${r * 0.22} ${r * 0.22} L0 ${r * 1.5} L${-r * 0.22} ${r * 0.22} L${-r * 1.5} 0 L${-r * 0.22} ${-r * 0.22} Z`}
          fill="#FFF3D6"
        />
      </g>
    </g>
  );
}
