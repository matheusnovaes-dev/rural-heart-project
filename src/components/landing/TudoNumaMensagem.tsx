import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";

import { MIDIA } from "@/assets/midia";
import serifaTexto from "@/assets/fontes/instrumentserif-texto.woff2?url";
import serifaTextoItalico from "@/assets/fontes/instrumentserif-texto-italico.woff2?url";
import { useExemplosDoDia, useHoje } from "@/hooks/useExemplosDoDia";
import { useMercadoDoDia } from "@/hooks/useMercadoDoDia";
import { brl2, diaMes, mesAnoCurto } from "@/lib/exemplosLanding";

/**
 * "Tudo que chega no seu WhatsApp" (só desktop, inspirado no site da Seasats): a seção fica presa na tela enquanto se
 * rola, uma frase por vez acende (as outras ficam apagadas) e, ao lado, flutua um recorte do que o produtor recebe, com
 * etiqueta em fonte mono. Os recortes de preço, dólar, futuros e plantio usam o dado REAL do dia (mesmo cache da faixa
 * de preços, nenhuma consulta a mais); clima, caderno e lembrete são exemplos e dizem isso na etiqueta.
 *
 * Peso: no celular a seção é display:none (a foto de fundo é background-image, que o navegador não baixa escondida) e
 * a serifa completa só é pedida no desktop, quando a seção está a ~1,5 tela de distância. Animação só com transform,
 * opacidade e um blur curto na entrada dos cartões; o scroll só troca um número (a frase ativa), não re-renderiza a cada
 * quadro. Quem pediu menos movimento recebe as trocas sem transição.
 */

const SERIFA = '"Instrument Serif Texto", "Instrument Serif", "Times New Roman", serif';

const FRASES = [
  "O preço da soja na sua praça.",
  "O dólar de hoje e o futuro na B3.",
  "A chuva da semana na sua cidade.",
  "A janela certa de plantar.",
  "O custo de cada saca que você colhe.",
  "A conta que vence na sexta.",
] as const;

let serifaPedida = false;
function carregarSerifaTexto() {
  if (serifaPedida || typeof document === "undefined" || !("fonts" in document)) return;
  serifaPedida = true;
  for (const [url, estilo] of [
    [serifaTexto, "normal"],
    [serifaTextoItalico, "italic"],
  ] as const) {
    const f = new FontFace("Instrument Serif Texto", `url(${url}) format("woff2")`, {
      style: estilo,
      weight: "400",
      display: "swap",
    });
    document.fonts.add(f);
    f.load().catch(() => {});
  }
}

export function TudoNumaMensagem() {
  const ref = useRef<HTMLElement>(null);
  const [ativo, setAtivo] = useState(0);
  const [perto, setPerto] = useState(false);

  // Fonte e fundo só quando a seção se aproxima, e só se ela estiver visível (desktop).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && el.offsetParent !== null) {
          carregarSerifaTexto();
          setPerto(true);
          io.disconnect();
        }
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setAtivo(Math.min(FRASES.length - 1, Math.max(0, Math.floor(v * FRASES.length))));
  });
  // Função (não lista): a forma em lista vira animação nativa de scroll do framer e quebra com sticky.
  const escalaFundo = useTransform(scrollYProgress, (v) => 1.14 - v * 0.14);
  const deriva = useTransform(scrollYProgress, (v) => (0.5 - v) * 90);

  return (
    <section
      ref={ref}
      id="no-whatsapp"
      aria-labelledby="tudo-numa-mensagem"
      className="relative hidden bg-[oklch(0.2_0.03_156)] lg:block"
      style={{ height: `${FRASES.length * 62 + 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center will-change-transform"
          style={{
            scale: escalaFundo,
            backgroundImage: perto ? `url(${MIDIA.hero1920})` : undefined,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.17_0.03_156/0.92)_0%,oklch(0.19_0.03_156/0.7)_42%,oklch(0.15_0.03_156/0.94)_100%)]"
        />
        <div aria-hidden="true" className="grao" />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center px-6 pt-[11vh]">
          <p className="font-mono text-[11px] font-medium tracking-[0.28em] text-white/55 uppercase">
            O que chega no seu WhatsApp
          </p>
          <h2 id="tudo-numa-mensagem" className="sr-only">
            Tudo que pesa na sua decisão, numa mensagem de WhatsApp
          </h2>
          <ol className="mt-6 space-y-1 text-center" style={{ fontFamily: SERIFA }}>
            {FRASES.map((f, i) => (
              <li
                key={f}
                aria-current={i === ativo ? "step" : undefined}
                className="text-[clamp(1.55rem,2.35vw,2.45rem)] leading-[1.18] text-white transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none"
                style={{
                  opacity: i === ativo ? 1 : 0.3,
                  transform: i === ativo ? "translateY(0)" : "translateY(0) scale(0.985)",
                }}
              >
                {f}
              </li>
            ))}
          </ol>
          <p
            className="mt-5 text-[clamp(1.2rem,1.6vw,1.6rem)] text-[color:var(--cta)] italic transition-opacity duration-700 motion-reduce:transition-none"
            style={{ fontFamily: SERIFA, opacity: ativo === FRASES.length - 1 ? 1 : 0 }}
          >
            Tudo numa mensagem, com fonte e data.
          </p>
        </div>

        {/* Recortes flutuando: o da frase ativa entra, o anterior sai subindo. */}
        <motion.div aria-hidden="true" className="absolute inset-0 z-10" style={{ y: deriva }}>
          <Recortes ativo={ativo} />
        </motion.div>

        {/* Régua de progresso na lateral, como a do site de referência */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 right-6 z-10 h-40 w-px -translate-y-1/2 bg-white/15"
        >
          <motion.div
            className="absolute inset-x-0 top-0 origin-top bg-white/70"
            style={{ height: "100%", scaleY: scrollYProgress }}
          />
        </div>
      </div>
    </section>
  );
}

/** Posições dos recortes (em % da tela): abaixo do bloco de frases e alternando os lados. */
// À esquerda, longe do índice de capítulos do desktop (que ocupa ~150px da borda).
const ESQ = "max(11%, 10.5rem)";
const POSICOES: { left?: string; right?: string; top: string; giro: number }[][] = [
  [{ left: ESQ, top: "57%", giro: -1.5 }],
  [
    { right: "5%", top: "53%", giro: 1.2 },
    { left: ESQ, top: "60%", giro: -1 },
  ],
  [{ left: ESQ, top: "56%", giro: -1.2 }],
  [{ right: "6%", top: "57%", giro: 1.4 }],
  [{ left: ESQ, top: "58%", giro: -1.4 }],
  [{ right: "7%", top: "56%", giro: 1 }],
];

function Recortes({ ativo }: { ativo: number }) {
  const exemplos = useExemplosDoDia();
  const mercado = useMercadoDoDia();
  const hoje = useHoje();

  const conteudos: ReactNode[][] = [
    [<CartaoPreco key="preco" exemplos={exemplos} />],
    [
      <CartaoDolar key="dolar" mercado={mercado} />,
      <CartaoFuturo key="futuro" exemplos={exemplos} />,
    ],
    [<CartaoClima key="clima" hoje={hoje} />],
    [<CartaoPlantio key="plantio" exemplos={exemplos} />],
    [<CartaoCaderno key="caderno" />],
    [<CartaoLembrete key="lembrete" />],
  ];

  return (
    <>
      {conteudos.map((grupo, i) =>
        grupo.map((c, j) => {
          const pos = POSICOES[i]![j]!;
          const estado = i === ativo ? "atual" : i < ativo ? "passou" : "depois";
          return (
            <div
              key={`${i}-${j}`}
              className="absolute w-[min(25rem,30vw)] transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{
                left: pos.left,
                right: pos.right,
                top: pos.top,
                opacity: estado === "atual" ? 1 : 0,
                filter: estado === "atual" ? "blur(0)" : "blur(6px)",
                transform:
                  estado === "atual"
                    ? `translateY(0) rotate(${pos.giro}deg) scale(1)`
                    : estado === "passou"
                      ? `translateY(-70px) rotate(${pos.giro * 2}deg) scale(0.94)`
                      : `translateY(60px) rotate(0deg) scale(0.96)`,
                transitionDelay: estado === "atual" ? `${j * 120}ms` : "0ms",
              }}
            >
              {c}
            </div>
          );
        }),
      )}
    </>
  );
}

/** Moldura dos recortes: etiqueta mono em aba branca (como as legendas das fotos da referência) e cartão claro. */
function Recorte({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <span className="inline-block bg-white px-2.5 py-1 font-mono text-[10.5px] font-medium tracking-[0.16em] text-[oklch(0.25_0.03_156)] uppercase">
        {etiqueta}
      </span>
      <div className="rounded-tr-xl rounded-b-xl bg-white/95 p-5 text-[oklch(0.22_0.03_156)] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)]">
        {children}
      </div>
    </div>
  );
}

function Variacao({ pct, sufixo }: { pct: number | null | undefined; sufixo: string }) {
  if (pct == null) return null;
  const sobe = pct > 0.05;
  const desce = pct < -0.05;
  return (
    <span
      className={`font-mono text-xs font-medium ${sobe ? "text-[#1f8f55]" : desce ? "text-[#c2412d]" : "text-[oklch(0.5_0.02_156)]"}`}
    >
      {sobe ? "+" : desce ? "−" : ""}
      {brl2(Math.abs(pct))}% {sufixo}
    </span>
  );
}

function CartaoPreco({ exemplos }: { exemplos: ReturnType<typeof useExemplosDoDia> }) {
  const praca = exemplos?.comparativoSoja?.find((p) => p.uf === "MT") ?? null;
  const serie = exemplos?.serieSoja?.pontos ?? [];
  return (
    <Recorte
      etiqueta={
        praca ? `Soja · Sorriso/MT · ${diaMes(praca.data)} · BBM` : "Soja · Sorriso/MT · BBM"
      }
    >
      <p className="text-xs text-[oklch(0.45_0.02_156)]">Preço da saca de 60 kg</p>
      <p className="mt-1 font-mono text-[2rem] leading-none font-semibold tracking-tight">
        {praca ? `R$ ${brl2(praca.preco)}` : "R$ —"}
      </p>
      <div className="mt-2">
        <Variacao pct={praca?.variacaoSemana} sufixo="na semana" />
      </div>
      {serie.length >= 10 && <Linha pontos={serie.map((p) => p.preco)} />}
    </Recorte>
  );
}

function Linha({ pontos }: { pontos: number[] }) {
  const min = Math.min(...pontos);
  const max = Math.max(...pontos);
  const amp = max - min || 1;
  const d = pontos
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i / (pontos.length - 1)) * 300).toFixed(1)},${(52 - ((v - min) / amp) * 46).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 300 56" className="mt-3 h-14 w-full" preserveAspectRatio="none">
      <path d={`${d} L300,56 L0,56 Z`} fill="oklch(0.62 0.12 150 / 0.12)" />
      <path
        d={d}
        fill="none"
        stroke="oklch(0.45 0.1 152)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CartaoDolar({ mercado }: { mercado: ReturnType<typeof useMercadoDoDia> }) {
  const d = mercado?.itens.find((i) => i.unidade === "dolar") ?? null;
  return (
    <Recorte etiqueta={d ? `Dólar · Banco Central · ${diaMes(d.data)}` : "Dólar · Banco Central"}>
      <p className="font-mono text-[1.75rem] leading-none font-semibold tracking-tight">
        {d
          ? `R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
          : "R$ —"}
      </p>
      <div className="mt-2">
        <Variacao pct={d?.varPct} sufixo="em 7 dias" />
      </div>
    </Recorte>
  );
}

function CartaoFuturo({ exemplos }: { exemplos: ReturnType<typeof useExemplosDoDia> }) {
  const f = exemplos?.futuroSoja;
  const moeda = f?.unidade.toLowerCase().includes("us$") ? "US$" : "R$";
  return (
    <Recorte etiqueta="Soja · Futuros B3">
      {f ? (
        <ul className="space-y-1.5">
          {f.contratos.slice(0, 3).map((c) => (
            <li key={c.vencimento} className="flex items-baseline justify-between gap-6">
              <span className="font-mono text-xs tracking-wider text-[oklch(0.45_0.02_156)] uppercase">
                {mesAnoCurto(c.vencimento)}
              </span>
              <span className="font-mono text-base font-semibold">
                {moeda} {brl2(c.valor)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">Vencimentos e ajuste do dia</p>
      )}
    </Recorte>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Exemplo: chuva em mm por dia (dado de verdade, por cidade, só no WhatsApp e no painel). */
const CHUVA_EXEMPLO = [0, 2, 14, 31, 8];

function CartaoClima({ hoje }: { hoje: Date | null }) {
  return (
    <Recorte etiqueta="Clima · 5 dias · exemplo">
      <div className="flex items-end justify-between gap-3">
        {CHUVA_EXEMPLO.map((mm, i) => {
          const dia = hoje ? DIAS_SEMANA[(hoje.getDay() + i) % 7] : "";
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[11px] text-[oklch(0.45_0.02_156)]">{mm} mm</span>
              <span className="flex h-16 w-full items-end overflow-hidden rounded-md bg-[oklch(0.94_0.01_156)]">
                <span
                  className="w-full rounded-md bg-[oklch(0.62_0.09_235)]"
                  style={{ height: `${Math.max(6, (mm / 31) * 100)}%` }}
                />
              </span>
              <span className="font-mono text-[11px] tracking-wider uppercase">
                {i === 0 ? "Hoje" : dia}
              </span>
            </div>
          );
        })}
      </div>
    </Recorte>
  );
}

function CartaoPlantio({ exemplos }: { exemplos: ReturnType<typeof useExemplosDoDia> }) {
  const p = exemplos?.plantio;
  const aberta = p?.riscoHoje != null;
  return (
    <Recorte etiqueta="Plantio · soja · Sorriso/MT · ZARC">
      {p ? (
        <>
          <p className="text-lg font-semibold">
            {aberta ? "Janela aberta" : "Fora da janela"}
            <span className="ml-2 font-mono text-sm font-medium text-[oklch(0.45_0.02_156)]">
              {aberta ? `risco ${p.riscoHoje}%` : ""}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-[oklch(0.45_0.02_156)]">{p.periodoAtual}</p>
          {p.proximas.some((j) => j.periodo !== p.periodoAtual) && (
            <ul className="mt-3 space-y-1">
              {p.proximas
                .filter((j) => j.periodo !== p.periodoAtual)
                .slice(0, 2)
                .map((j) => (
                  <li key={j.periodo} className="flex justify-between gap-4 text-xs">
                    <span>{j.periodo}</span>
                    <span className="font-mono">{j.risco != null ? `risco ${j.risco}%` : "—"}</span>
                  </li>
                ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm">Janela de plantio e risco climático do Zoneamento Agrícola</p>
      )}
    </Recorte>
  );
}

function CartaoCaderno() {
  return (
    <Recorte etiqueta="Caderno da fazenda · exemplo">
      <p className="text-sm">
        <span className="font-semibold">Anotei no caderno:</span> gasto de R$ 800, diesel.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[oklch(0.9_0.01_156)] pt-3">
        <div>
          <p className="font-mono text-[10.5px] tracking-wider text-[oklch(0.45_0.02_156)] uppercase">
            Custo por saca
          </p>
          <p className="font-mono text-xl font-semibold">R$ 118,40</p>
        </div>
        <div>
          <p className="font-mono text-[10.5px] tracking-wider text-[oklch(0.45_0.02_156)] uppercase">
            Margem hoje
          </p>
          <p className="font-mono text-xl font-semibold text-[#1f8f55]">14%</p>
        </div>
      </div>
    </Recorte>
  );
}

function CartaoLembrete() {
  return (
    <Recorte etiqueta="Lembrete · 8h · exemplo">
      <p className="text-sm leading-relaxed">
        Hoje vence o <span className="font-semibold">arrendamento</span>:{" "}
        <span className="font-mono font-semibold">R$ 5.000</span>. Quando pagar, é só dizer
        &ldquo;paguei&rdquo;.
      </p>
    </Recorte>
  );
}
