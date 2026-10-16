import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  motion,
  transform,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Sprout } from "lucide-react";

import { useMercadoDoDia } from "@/hooks/useMercadoDoDia";
import { brl, diaMesCurto, type SojaParaDemo } from "@/lib/mercadoLanding";

/**
 * Demo do WhatsApp que se escreve sozinha enquanto a pessoa rola a página (no lugar do vídeo de 14 MB).
 * O celular fica fixo na tela e o progresso do scroll comanda tudo: as mensagens entram, o preço conta de 0 até
 * o valor, o gráfico se desenha e a conversa sobe como num chat de verdade. Só transform e opacidade (nada que
 * recalcule layout) e uns poucos KB de código. Os números são o preço REAL de hoje (BBM, média das praças de MT);
 * sem dado o exemplo cai num valor ilustrativo e a legenda avisa. Quem prefere menos movimento vê a conversa
 * inteira parada, na ordem de leitura.
 */

const FALLBACK: SojaParaDemo = {
  uf: "MT",
  valor: 140,
  data: "",
  serie: [132, 133, 134, 133, 135, 136, 135, 137, 138, 137, 139, 140],
  media90: 138,
  vsMedia90Pct: 1.4,
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const suave = (x: number) => x * x * (3 - 2 * x);

/**
 * Mapeia o progresso para um valor por faixas. Função (e não o formato [entradas], [saídas]) de propósito:
 * o framer-motion passa as transformações em lista para uma animação nativa ligada ao scroll, que aqui
 * (sticky + offset customizado) saía diferente do cálculo em JS. Com função, ele sempre calcula em JS.
 */
const faixa = (p: MotionValue<number>, entrada: number[], saida: number[]) =>
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useTransform(p, (v) => transform(v, entrada, saida));

function Bolha({
  lado,
  p,
  a,
  b,
  children,
}: {
  lado: "bot" | "user";
  p: MotionValue<number>;
  a: number;
  b: number;
  children: ReactNode;
}) {
  const opacity = faixa(p, [a, b], [0, 1]);
  const y = faixa(p, [a, b], [16, 0]);
  return (
    <motion.div
      style={{ opacity, y }}
      className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-sm motion-reduce:transform-none! motion-reduce:opacity-100! sm:text-sm ${
        lado === "bot" ? "mr-auto rounded-tl-sm bg-white" : "ml-auto rounded-tr-sm bg-[#d9fdd3]"
      }`}
    >
      {children}
    </motion.div>
  );
}

/** Resposta do bot: "digitando…" enquanto não chega, depois o conteúdo (os dois no mesmo lugar, sem pular o layout). */
function RespostaDoBot({
  p,
  digitaDe,
  chegaDe,
  chegaAte,
  children,
}: {
  p: MotionValue<number>;
  digitaDe: number;
  chegaDe: number;
  chegaAte: number;
  children: ReactNode;
}) {
  const digitando = faixa(p, [digitaDe, digitaDe + 0.02, chegaDe - 0.02, chegaDe], [0, 1, 1, 0]);
  return (
    <div className="relative">
      <motion.div
        aria-hidden="true"
        style={{ opacity: digitando }}
        className="absolute top-0 left-0 flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-3 py-3 shadow-sm motion-reduce:hidden"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-[#8696a0]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </motion.div>
      <Bolha lado="bot" p={p} a={chegaDe} b={chegaAte}>
        {children}
      </Bolha>
    </div>
  );
}

function Grafico({ serie, p }: { serie: number[]; p: MotionValue<number> }) {
  const W = 220;
  const H = 54;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const faixa = max - min || 1;
  const pts = serie.map((v, i) => {
    const x = (i / (serie.length - 1)) * (W - 8) + 4;
    const y = H - 6 - ((v - min) / faixa) * (H - 14);
    return [x, y] as const;
  });
  const linha = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [px, py] = pts[0]!;
  const [ux, uy] = pts[pts.length - 1]!;
  const area = `${linha} L${ux.toFixed(1)} ${H} L${px.toFixed(1)} ${H} Z`;
  const desenho = useTransform(p, (v) => clamp01((v - 0.2) / 0.14));
  const preenche = useTransform(p, (v) => clamp01((v - 0.3) / 0.08));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="demo-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#25a05f" stopOpacity="0.28" />
          <stop offset="1" stopColor="#25a05f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#demo-area)"
        style={{ opacity: preenche }}
        className="motion-reduce:opacity-100!"
      />
      <motion.path
        d={linha}
        fill="none"
        stroke="#1f8f55"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pathLength: desenho }}
        className="motion-reduce:[stroke-dasharray:none]! motion-reduce:[stroke-dashoffset:0]!"
      />
      <motion.circle
        cx={ux}
        cy={uy}
        r="3.6"
        fill="#1f8f55"
        style={{ opacity: preenche }}
        className="motion-reduce:opacity-100!"
      />
    </svg>
  );
}

export function ChatScrollDemo() {
  const mercado = useMercadoDoDia();
  const real = mercado?.soja ?? null;
  const soja = real ?? FALLBACK;
  const variacao7d = mercado?.itens.find((i) => i.id === "soja")?.varPct ?? null;

  const alvoRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const maxY = useMotionValue(0);

  const { scrollYProgress: p } = useScroll({ target: alvoRef, offset: ["start start", "end end"] });

  // Quanto a conversa precisa subir pra mostrar a última mensagem (medido, pois depende da largura do celular).
  useLayoutEffect(() => {
    const area = areaRef.current;
    const lista = listaRef.current;
    if (!area || !lista) return;
    const medir = () => maxY.set(Math.max(0, lista.scrollHeight - area.clientHeight + 8));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(area);
    ro.observe(lista);
    return () => ro.disconnect();
  }, [maxY]);
  const subida = useTransform(
    [p, maxY],
    ([v, m]: number[]) => -(m ?? 0) * suave(clamp01(((v ?? 0) - 0.14) / 0.7)),
  );

  // O preço conta de 0 até o valor escrevendo direto no DOM (o HTML do servidor já traz o valor final,
  // então sem JS ou com menos movimento a pessoa vê o número certo e não há diferença na hidratação).
  const precoRef = useRef<HTMLSpanElement>(null);
  const contar = (v: number) => {
    if (precoRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      precoRef.current.textContent = `R$ ${brl(soja.valor * clamp01((v - 0.19) / 0.12))}`;
  };
  useMotionValueEvent(p, "change", contar);

  // Legendas dos 3 passos, trocando conforme a conversa avança.
  const l1 = faixa(p, [0, 0.26, 0.32], [1, 1, 0]);
  const l2 = faixa(p, [0.26, 0.32, 0.58, 0.64], [0, 1, 1, 0]);
  const l3 = faixa(p, [0.58, 0.64, 1], [0, 1, 1]);

  const limite = Math.ceil((soja.valor + 3) / 5) * 5;
  const acima = soja.vsMedia90Pct >= 0;
  const sinalTexto = `Hoje o preço está ${brl(Math.abs(soja.vsMedia90Pct), 1)}% ${acima ? "acima" : "abaixo"} da média dos últimos 90 dias (R$ ${brl(soja.media90)}).`;
  const sobe = variacao7d !== null && variacao7d > 0.05;
  const desce = variacao7d !== null && variacao7d < -0.05;

  return (
    <div ref={alvoRef} className="relative h-[290svh] motion-reduce:h-auto">
      <div className="sticky top-0 flex h-svh flex-col items-center gap-3 px-4 pt-[4.75rem] pb-4 motion-reduce:static motion-reduce:h-auto motion-reduce:pb-10">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Como funciona
        </h2>

        {/* Legenda do passo atual */}
        <div
          className="relative h-11 w-full max-w-md text-center motion-reduce:hidden"
          aria-hidden="true"
        >
          {[
            {
              t: "1. Mande uma mensagem",
              d: "Pergunte do jeito que você já usa o WhatsApp.",
              o: l1,
            },
            {
              t: "2. Cruzamos os dados oficiais",
              d: "Preço, histórico, bolsa e clima, na hora.",
              o: l2,
            },
            {
              t: "3. Você recebe o número certo",
              d: "E um aviso quando o preço chegar onde você quer.",
              o: l3,
            },
          ].map((s) => (
            <motion.div key={s.t} style={{ opacity: s.o }} className="absolute inset-0">
              <p className="font-display text-base font-semibold text-foreground">{s.t}</p>
              <p className="text-[13px] text-muted-foreground">{s.d}</p>
            </motion.div>
          ))}
        </div>

        <div className="w-full max-w-[19.5rem] rounded-[2.1rem] border-[7px] border-[oklch(0.244_0.026_155.8)] bg-[oklch(0.244_0.026_155.8)] shadow-2xl sm:max-w-sm">
          <div className="overflow-hidden rounded-[1.65rem] bg-[#e5ded4]">
            <div className="flex items-center gap-3 bg-[oklch(0.331_0.049_156.2)] px-4 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white">
                <Sprout className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Safralume</p>
                <p className="text-[11px] text-white/70">online</p>
              </div>
            </div>

            <div
              ref={areaRef}
              className="h-[clamp(18rem,calc(100svh-17.5rem),28rem)] overflow-hidden px-3 py-3 motion-reduce:h-auto motion-reduce:overflow-visible"
            >
              <motion.div
                ref={listaRef}
                style={{ y: subida }}
                className="flex flex-col gap-2 motion-reduce:transform-none!"
              >
                <div className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[13px] text-[#111b21] shadow-sm sm:text-sm">
                  Bom dia! Pergunte o preço de qualquer cultura e cidade. 🌱
                </div>

                <Bolha lado="user" p={p} a={0.03} b={0.08}>
                  Qual o preço da soja hoje no Mato Grosso?
                </Bolha>

                <RespostaDoBot p={p} digitaDe={0.09} chegaDe={0.17} chegaAte={0.24}>
                  <p className="text-[11px] font-semibold tracking-wide text-[#1f8f55] uppercase">
                    Soja · Mato Grosso
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                    <span
                      key={soja.valor}
                      ref={precoRef}
                      className="font-display text-2xl font-bold whitespace-nowrap tabular-nums"
                    >
                      R$ {brl(soja.valor)}
                    </span>
                    <span className="text-xs whitespace-nowrap text-[#54656f]">
                      por saca de 60 kg
                    </span>
                  </p>
                  {variacao7d !== null ? (
                    <p
                      className={`text-xs font-semibold ${sobe ? "text-[#1f8f55]" : desce ? "text-[#c2412d]" : "text-[#54656f]"}`}
                    >
                      {sobe ? "▲" : desce ? "▼" : "•"} {brl(Math.abs(variacao7d), 1)}% em 7 dias
                    </p>
                  ) : null}
                  <Grafico serie={soja.serie} p={p} />
                  <p className="text-[10.5px] text-[#667781]">
                    Média das praças de MT · BBM{soja.data ? ` · ${diaMesCurto(soja.data)}` : ""} ·
                    últimos 45 dias
                  </p>
                </RespostaDoBot>

                <Bolha lado="user" p={p} a={0.4} b={0.45}>
                  Vale vender agora?
                </Bolha>

                <RespostaDoBot p={p} digitaDe={0.46} chegaDe={0.55} chegaAte={0.62}>
                  <p className="text-[11px] font-semibold tracking-wide text-[#1f8f55] uppercase">
                    Sinal de venda
                  </p>
                  <p className="mt-0.5">{sinalTexto}</p>
                  <p className="mt-1.5 text-[#3b4a54]">
                    Eu cruzo isso com o mercado futuro da B3 e o clima da sua região pra te dizer se
                    vale vender agora ou esperar.
                  </p>
                </RespostaDoBot>

                <Bolha lado="user" p={p} a={0.7} b={0.75}>
                  Me avisa se passar de R$ {limite}
                </Bolha>

                <RespostaDoBot p={p} digitaDe={0.76} chegaDe={0.83} chegaAte={0.9}>
                  <p>
                    Pronto! ✅ Te aviso aqui no WhatsApp assim que a soja passar de{" "}
                    <strong>R$ {brl(limite)}</strong>.
                  </p>
                </RespostaDoBot>
              </motion.div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {real
            ? `Conversa de exemplo com o preço real de ${diaMesCurto(soja.data)}.`
            : "Conversa de exemplo, ilustrativa."}
        </p>
      </div>
    </div>
  );
}
