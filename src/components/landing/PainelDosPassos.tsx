import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Check } from "lucide-react";

const SERIFA = { fontFamily: '"Instrument Serif", "Times New Roman", serif' };

const FONTES = [
  "Conab",
  "Imea",
  "Deral/PR",
  "Epagri/SC",
  "Emater/RS",
  "BBM",
  "IEA-SP",
  "B3",
  "Banco Central",
];

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

/** Atraso (ms) de cada elemento de uma ilustração depois que o painel fica ativo. */
const atraso = (ms: number) => ({ transitionDelay: `${ms}ms` });
const entra =
  "translate-y-4 opacity-0 transition-[opacity,transform] duration-700 ease-out group-data-[ativo=true]:translate-y-0 group-data-[ativo=true]:opacity-100";

function Conversa() {
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-[#e8e1d3] shadow-xl ring-1 ring-black/5">
      <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
          S
        </span>
        <span className="text-sm font-semibold">Safralume</span>
        <span className="ml-auto text-xs text-primary-foreground/60">online</span>
      </div>
      <div className="flex min-h-[19rem] flex-col gap-3 p-4">
        <p
          className={`${entra} ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[#d8f2c4] px-3.5 py-2.5 text-sm text-[#1b2b1d]`}
          style={atraso(150)}
        >
          Qual o preço da soja em Cascavel?
        </p>
        <p
          className={`${entra} flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3`}
          style={atraso(750)}
          aria-hidden="true"
        >
          <span className="passos-ponto" />
          <span className="passos-ponto [animation-delay:150ms]" />
          <span className="passos-ponto [animation-delay:300ms]" />
        </p>
        <p
          className={`${entra} max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-[#1b2b1d]`}
          style={atraso(1500)}
        >
          Soja no Paraná: preço da sua região, comparado com o porto e já com o frete.
          <span className="mt-1.5 block text-xs text-[#1b2b1d]/55">
            Fonte e data em toda resposta
          </span>
        </p>
      </div>
    </div>
  );
}

function Fontes() {
  return (
    <div className="mx-auto w-full max-w-md">
      <ul className="flex flex-wrap justify-center gap-2.5">
        {FONTES.map((f, i) => (
          <li
            key={f}
            className={`${entra} inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm`}
            style={atraso(i * 110)}
          >
            <Check className="size-3.5 text-[color:var(--cta)]" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <p
        className={`${entra} mt-6 text-center text-sm font-medium text-muted-foreground`}
        style={atraso(1200)}
      >
        Duas fontes cobrindo a mesma cultura e estado? Cruzamos uma com a outra antes de mostrar.
      </p>
    </div>
  );
}

function Resposta() {
  const linhas = [
    ["Preço na sua região", "R$ 134,98"],
    ["No porto de Paranaguá", "R$ 155,50"],
    ["Frete até o porto", "R$ 11,77"],
  ] as const;
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary-foreground/60 uppercase">
        Soja · saca de 60 kg
      </p>
      <ul className="mt-4 divide-y divide-white/10">
        {linhas.map(([rotulo, valor], i) => (
          <li
            key={rotulo}
            className={`${entra} flex items-baseline justify-between gap-4 py-3`}
            style={atraso(150 + i * 250)}
          >
            <span className="text-sm text-primary-foreground/80">{rotulo}</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{valor}</span>
          </li>
        ))}
      </ul>
      <p
        className={`${entra} mt-3 flex items-baseline justify-between gap-4 rounded-xl bg-white/10 px-4 py-3`}
        style={atraso(1000)}
      >
        <span className="text-sm font-semibold">Sobra na paridade</span>
        <span className="font-mono text-2xl font-bold text-[color:var(--cta)] tabular-nums">
          R$ 143,73
        </span>
      </p>
      <p className={`${entra} mt-3 text-xs text-primary-foreground/55`} style={atraso(1250)}>
        Fonte: BBM, com data de referência
      </p>
    </div>
  );
}

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
              className="group flex w-1/3 shrink-0 justify-center px-6"
            >
              <div className="grid w-full max-w-6xl grid-cols-[1fr_1.05fr] items-center gap-12">
                <div className="relative pr-6">
                  <span
                    aria-hidden="true"
                    className="block text-[11rem] leading-[0.8] text-[color:var(--cta)]/90 italic select-none"
                    style={SERIFA}
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-foreground">
                    {passo.titulo}
                  </h3>
                  <p className="mt-4 max-w-md text-lg text-muted-foreground">{passo.texto}</p>
                </div>
                <div>
                  <Visual />
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
