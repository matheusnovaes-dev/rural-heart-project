import { useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Conversa, Fontes, Resposta } from "@/components/landing/VisuaisDosPassos";

const SERIFA = { fontFamily: '"Instrument Serif", "Times New Roman", serif' };

const PASSOS = [
  {
    titulo: "Mande uma mensagem",
    texto: "Pergunte o preço da sua cultura e cidade, do jeito que você já usa o WhatsApp.",
  },
  {
    titulo: "Cruzamos os dados oficiais",
    texto:
      "Consultamos Conab e órgãos estaduais na hora e comparamos com o preço do porto e o frete.",
  },
  {
    titulo: "Você recebe o número certo",
    texto:
      "Preço da sua região, do porto e o frete, com fonte e data, pronto para decidir sem depender de planilha.",
  },
] as const;

const VISUAIS = [Conversa, Fontes, Resposta];

/** Rolagem (0 a 1) -> posição da trilha em "painéis" (0, 1 ou 2), com pausa em cada painel e deslize suave entre eles. */
const PAUSAS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.16, 0],
  [0.4, 1],
  [0.58, 1],
  [0.82, 2],
  [1, 2],
];
const suave = (t: number) => t * t * (3 - 2 * t);
function posicaoDaTrilha(v: number): number {
  if (v <= 0) return 0;
  for (let i = 1; i < PAUSAS.length; i++) {
    const [v1, p1] = PAUSAS[i]!;
    const [v0, p0] = PAUSAS[i - 1]!;
    if (v <= v1) return p0 + (p1 - p0) * suave((v - v0) / (v1 - v0));
  }
  return 2;
}

/**
 * Cartão de vidro em profundidade (como o carrossel do site do Active Theory): quando o painel está parado no centro, a
 * ilustração fica de frente; enquanto a trilha desliza, ela gira no eixo vertical e recua (o que chega vem da direita
 * inclinado, o que sai vai para a esquerda), com uma faixa de reflexo de vidro atravessando. Só transform/opacity, guiado
 * pela mesma posição da trilha.
 */
function VidroEmProfundidade({
  i,
  progresso,
  children,
}: {
  i: number;
  progresso: MotionValue<number>;
  children: ReactNode;
}) {
  const transform = useTransform(progresso, (v) => {
    const d = Math.max(-1.3, Math.min(1.3, i - posicaoDaTrilha(v)));
    const z = -Math.abs(d) * 320;
    return `perspective(1400px) translate3d(${(d * 6).toFixed(2)}%,0,${z.toFixed(1)}px) rotateY(${(-d * 34).toFixed(2)}deg) rotateX(${(Math.abs(d) * 5).toFixed(2)}deg)`;
  });
  // o que está saindo (à esquerda) apaga mais rápido, para não disputar com o título do próximo passo
  const opacity = useTransform(progresso, (v) => {
    const d = i - posicaoDaTrilha(v);
    return 1 - Math.min(d < 0 ? 0.92 : 0.6, Math.abs(d) * (d < 0 ? 1.1 : 0.6));
  });
  // reflexo: só aparece enquanto o cartão está girando, e corre no sentido do giro
  const reflexoX = useTransform(progresso, (v) => `${(i - posicaoDaTrilha(v)) * 140}%`);
  const reflexoOp = useTransform(progresso, (v) =>
    Math.min(1, Math.abs(i - posicaoDaTrilha(v)) * 2.2),
  );
  return (
    <motion.div
      style={{ transform, opacity }}
      className="relative will-change-transform [transform-style:preserve-3d]"
    >
      {children}
      <motion.span
        aria-hidden="true"
        style={{ x: reflexoX, opacity: reflexoOp }}
        className="pointer-events-none absolute inset-y-0 left-1/4 w-1/2 bg-[linear-gradient(105deg,transparent_20%,rgba(255,255,255,0.32)_50%,transparent_80%)] mix-blend-soft-light"
      />
    </motion.div>
  );
}

/** O número grande do passo anda um pouco mais devagar que a trilha (paralaxe), como camada mais ao fundo. */
function NumeroDoPasso({ i, progresso }: { i: number; progresso: MotionValue<number> }) {
  const x = useTransform(progresso, (v) => `${(i - posicaoDaTrilha(v)) * -38}%`);
  return (
    <motion.span
      aria-hidden="true"
      style={{ ...SERIFA, x }}
      className="block text-[14rem] leading-[0.8] text-[color:var(--cta)]/90 italic select-none"
    >
      {i + 1}
    </motion.span>
  );
}

/**
 * Os três passos do "Como funciona" numa seção que fica FIXA enquanto a rolagem vertical empurra os painéis de lado (a
 * galeria horizontal do site do Lando Norris), de borda a borda da tela, com uma pausa em cada painel. Só desktop de
 * verdade (variante `desk`: tela larga + mouse); no celular e no tablet continua a lista vertical de antes. Só transform:
 * a trilha anda por uma função de scroll do framer (a forma em lista vira animação nativa e quebra com `position:
 * sticky`). As ilustrações dos painéis são HTML/CSS leve, rotuladas como exemplo. O painel ativo dispara a entrada em
 * sequência dos elementos dele.
 */
export default function PainelDosPassos({ progresso }: { progresso: MotionValue<number> }) {
  const [ativo, setAtivo] = useState(0);
  useMotionValueEvent(progresso, "change", (v) => {
    const pos = posicaoDaTrilha(v);
    const i = pos < 0.5 ? 0 : pos < 1.5 ? 1 : 2;
    setAtivo((anterior) => (anterior === i ? anterior : i));
  });
  const x = useTransform(progresso, (v) => `${-(100 / 3) * posicaoDaTrilha(v)}%`);
  // uma barrinha por passo (como em "stories"): cheia quando a trilha já chegou naquele painel
  const b0 = useTransform(progresso, (v) => Math.min(1, Math.max(0, posicaoDaTrilha(v) + 1)));
  const b1 = useTransform(progresso, (v) => Math.min(1, Math.max(0, posicaoDaTrilha(v))));
  const b2 = useTransform(progresso, (v) => Math.min(1, Math.max(0, posicaoDaTrilha(v) - 1)));

  return (
    <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden">
      <motion.div style={{ x }} className="flex w-[300%] will-change-transform">
        {PASSOS.map((passo, i) => {
          const Visual = VISUAIS[i]!;
          return (
            <article
              key={passo.titulo}
              data-ativo={ativo === i}
              className="group flex w-1/3 shrink-0 justify-center px-6 xl:pr-16 xl:pl-48"
            >
              <div className="grid w-full max-w-[86rem] grid-cols-[0.95fr_1.05fr] items-center gap-16">
                <div className="relative z-10 pr-6">
                  <NumeroDoPasso i={i} progresso={progresso} />
                  <h3 className="mt-6 font-display text-5xl leading-[1.02] font-extrabold tracking-tight text-foreground text-balance xl:text-6xl">
                    {passo.titulo}
                  </h3>
                  <p className="mt-5 max-w-lg text-xl leading-relaxed text-muted-foreground">
                    {passo.texto}
                  </p>
                </div>
                {/* ilustração ~30% maior (zoom mantém a caixa coerente com o tamanho visto, sem sobrepor o texto) */}
                <div className="relative z-0" style={{ zoom: 1.3 }}>
                  <VidroEmProfundidade i={i} progresso={progresso}>
                    <Visual />
                  </VidroEmProfundidade>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Exemplo ilustrativo
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </motion.div>

      <div aria-hidden="true" className="mx-auto mt-8 flex w-full max-w-md gap-3 px-4">
        {[b0, b1, b2].map((b, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-primary/15">
            <motion.span
              style={{ scaleX: b }}
              className="block h-full origin-left bg-[color:var(--cta)]"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
