import { carregarFonte, FONTES_PAINEL_URL } from "@/lib/fontes";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  TrendingUp,
  CloudSun,
  ArrowUp,
  ArrowDown,
  Fuel,
  DollarSign,
  Globe,
  Target,
  Star,
  Bell,
  Clock,
  LifeBuoy,
  CheckCircle2,
  Sprout,
  BadgeCheck,
  FlaskConical,
  Bug,
  Gavel,
  MousePointer2,
  LogOut,
} from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { cn } from "@/lib/utils";
import { carregarSupabase } from "@/lib/supabaseLazy";
import { buscarPrecosDaUf } from "@/lib/precos";
import { useExemplosDoDia, useHoje } from "@/hooks/useExemplosDoDia";
import { brl2, haDiasAtras, proximosDecendios } from "@/lib/exemplosLanding";
import { MIDIA } from "@/assets/midia";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";
import { GraficoPrecoReal } from "@/components/landing/GraficoPrecoReal";

/**
 * Preço real de soja (GO/MT/PR) pra substituir o número ilustrativo no
 * preview da landing — pedido do Matheus 2026-10-08: reforça a mensagem
 * "fonte oficial, não achismo" mostrando dado de verdade em vez de mockup.
 * Busca com a MESMA função que o painel de verdade usa (lib/precos.ts),
 * client-side com a chave pública (preço não é dado sensível). Nunca
 * trava a landing: se falhar ou ainda não carregou, cai no número
 * ilustrativo de sempre — a legenda "dados de exemplo" continua valendo
 * nesse meio tempo.
 */
function usePrecosReaisSoja(perto: boolean) {
  const [precos, setPrecos] = useState<{ GO: number; MT: number; PR: number } | null>(null);

  // Só busca quando a prévia está perto de aparecer: o cliente do Supabase (52KB) e as 3 consultas não disputam
  // banda com o primeiro desenho da landing.
  useEffect(() => {
    if (!perto) return;
    let cancelado = false;
    carregarSupabase().then((supabase) => {
      if (!supabase || cancelado) return;
      Promise.all(
        (["GO", "MT", "PR"] as const).map((uf) =>
          buscarPrecosDaUf(supabase, "soja", uf)
            .then((r) => r.serieEstado.at(-1)?.preco ?? null)
            .catch(() => null),
        ),
      ).then(([go, mt, pr]) => {
        if (cancelado) return;
        if (go != null && mt != null && pr != null) setPrecos({ GO: go, MT: mt, PR: pr });
      });
    });
    return () => {
      cancelado = true;
    };
  }, [perto]);

  return precos;
}

type PlanoId = "bronze" | "prata" | "ouro";

const planoBadge: Record<PlanoId, { label: string; className: string }> = {
  bronze: { label: "Bronze", className: "bg-secondary text-muted-foreground" },
  prata: { label: "Prata", className: "bg-zinc-200 text-zinc-700" },
  ouro: { label: "Ouro", className: "bg-gold text-gold-foreground" },
};

type AbaId =
  | "precos"
  | "sinal"
  | "alertas"
  | "fazenda"
  | "estoque"
  | "clima"
  | "plantio"
  | "ferrugem"
  | "insumos"
  | "leiloes"
  | "suporte"
  | "acompanhamento";

const abas: {
  id: AbaId;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
  plano: PlanoId;
}[] = [
  { id: "precos", label: "Preços", icon: IconesSafralume["preco"], plano: "bronze" },
  { id: "sinal", label: "Sinal de venda", icon: IconesSafralume["sinal-venda"], plano: "bronze" },
  { id: "alertas", label: "Alertas & lembretes", icon: IconesSafralume["alerta"], plano: "bronze" },
  { id: "fazenda", label: "Caderno da fazenda", icon: IconesSafralume["safra"], plano: "bronze" },
  {
    id: "estoque",
    label: "Estoque e aviso de venda",
    icon: IconesSafralume["saca"],
    plano: "prata",
  },
  { id: "clima", label: "Clima", icon: IconesSafralume["clima-sol"], plano: "bronze" },
  { id: "plantio", label: "Plantio", icon: IconesSafralume["janela-plantio"], plano: "bronze" },
  {
    id: "ferrugem",
    label: "Ferrugem",
    icon: IconesSafralume["ferrugem-asiatica"],
    plano: "bronze",
  },
  { id: "insumos", label: "Insumos", icon: IconesSafralume["insumos"], plano: "prata" },
  { id: "leiloes", label: "Leilões", icon: IconesSafralume["leilao"], plano: "prata" },
  { id: "suporte", label: "Suporte", icon: IconesSafralume["suporte"], plano: "bronze" },
  {
    id: "acompanhamento",
    label: "Acompanhamento",
    icon: IconesSafralume["acompanhamento"],
    plano: "ouro",
  },
];

const INTERVALO_AUTOPLAY = 3800;

/**
 * Desktop: as 12 abas são percorridas em 6 capítulos (antes eram 12 paradas iguais, ~6.300px de rolagem com a mesma
 * moldura). Cada capítulo tem um "peso" de rolagem; dentro dele, a rolagem passa pelas abas do capítulo e a câmera
 * se aproxima do conteúdo e volta. Todas as abas continuam no menu do painel e clicáveis.
 */
const CAPITULOS: { titulo: string; texto: string; abas: AbaId[]; peso: number }[] = [
  {
    titulo: "Preço da sua praça",
    texto:
      "O preço da sua região com histórico, a variação da semana e a comparação com outros estados.",
    abas: ["precos"],
    peso: 1,
  },
  {
    titulo: "Sinal de venda",
    texto: "Preço, futuros da B3 e clima juntos dizem se é hora de vender ou de esperar.",
    abas: ["sinal"],
    peso: 1,
  },
  {
    titulo: "Alertas e lembretes",
    texto: "Avisos de preço, clima e dólar, e lembretes da lavoura, direto no WhatsApp.",
    abas: ["alertas"],
    peso: 1,
  },
  {
    titulo: "Caderno da fazenda",
    texto:
      "Gastos, vendas e estoque por mensagem, áudio ou foto da nota, com custo por saca e aviso quando o preço bate a sua meta.",
    abas: ["fazenda", "estoque"],
    peso: 1.4,
  },
  {
    titulo: "Clima e lavoura",
    texto:
      "Previsão da sua cidade, janela de plantio oficial (ZARC) e risco de ferrugem na região.",
    abas: ["clima", "plantio", "ferrugem"],
    peso: 1.5,
  },
  {
    titulo: "E tem mais",
    texto:
      "Preço de insumos, agenda de leilões, suporte e uma lista pra acompanhar outras culturas.",
    abas: ["insumos", "leiloes", "suporte", "acompanhamento"],
    peso: 1.6,
  },
];
const PESO_TOTAL = CAPITULOS.reduce((t, c) => t + c.peso, 0);
/** Rolagem (em vh) de cada unidade de peso no desktop. */
const VH_POR_PESO = 44;

/** Em que capítulo a rolagem está (0..5) e quanto dele já passou (0..1). */
function capituloDaRolagem(v: number): { c: number; dentro: number } {
  let acumulado = 0;
  const alvo = Math.min(0.9999, Math.max(0, v)) * PESO_TOTAL;
  for (let c = 0; c < CAPITULOS.length; c++) {
    const peso = CAPITULOS[c]!.peso;
    if (alvo < acumulado + peso) return { c, dentro: (alvo - acumulado) / peso };
    acumulado += peso;
  }
  return { c: CAPITULOS.length - 1, dentro: 1 };
}

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function DashboardPreview() {
  const raiz = useRef<HTMLDivElement>(null);
  const [perto, setPerto] = useState(false);
  // As fontes do painel (DM Sans e Space Grotesk, ~85 KB) só são baixadas quando o mockup está perto de aparecer.
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          carregarFonte(FONTES_PAINEL_URL);
          setPerto(true);
          io.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const trilho = useRef<HTMLDivElement>(null);
  // Desktop: a rolagem escolhe a aba (seção fixa na tela). Detectado no navegador; o CSS (variante "desk") já reserva
  // a altura e gruda a seção, então a página não pula quando isso liga.
  const [fixo, setFixo] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
    const atualizar = () => setFixo(mq.matches);
    atualizar();
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, []);
  const { scrollYProgress: progresso } = useScroll({
    target: trilho,
    offset: ["start start", "end end"],
  });
  const [aba, setAba] = useState<AbaId>("precos");
  useMotionValueEvent(progresso, "change", (v) => {
    if (!fixo) return;
    const { c, dentro } = capituloDaRolagem(v);
    const lista = CAPITULOS[c]!.abas;
    const alvo = lista[Math.min(lista.length - 1, Math.floor(dentro * lista.length))]!;
    setAba((atual) => (atual === alvo ? atual : alvo));
  });
  // Câmera: em cada capítulo o painel começa inteiro, aproxima do conteúdo e volta antes de trocar de capítulo.
  // Calculado direto da rolagem (motion value), sem re-renderizar o React a cada quadro.
  const zoom = useTransform(progresso, (v) => {
    const { c, dentro } = capituloDaRolagem(v);
    const ultimo = c === CAPITULOS.length - 1;
    return 1 + 0.14 * suave(0.06, 0.32, dentro) * (ultimo ? 1 : 1 - suave(0.8, 0.97, dentro));
  });
  const capituloAtual = CAPITULOS.findIndex((c) => c.abas.includes(aba));
  const [autoplay, setAutoplay] = useState(true);
  const retomarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const precosReais = usePrecosReaisSoja(perto);
  const exemplosDoDia = useExemplosDoDia();

  // Cursor fantasma: mede a posição real do botão ativo (getBoundingClientRect,
  // não um cálculo de índice × altura fixa, que quebraria se o texto quebrasse
  // linha) e anima até lá — pedido do Matheus depois de achar o preview
  // "parecido com antes": em vez de só decorar a troca de aba, agora parece
  // alguém de verdade clicando, não um carrossel de imagens.
  const sidebarRef = useRef<HTMLDivElement>(null);
  const botaoRefs = useRef<Partial<Record<AbaId, HTMLButtonElement | null>>>({});
  const [cursorPos, setCursorPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const botao = botaoRefs.current[aba];
    if (!sidebar || !botao) return;
    const rectSidebar = sidebar.getBoundingClientRect();
    const rectBotao = botao.getBoundingClientRect();
    setCursorPos({
      top: rectBotao.top - rectSidebar.top + rectBotao.height / 2,
      left: rectBotao.left - rectSidebar.left + rectBotao.width - 10,
    });
  }, [aba]);

  useEffect(() => {
    // Celular (< 640px): sem troca automática. Cada aba tem uma altura (384 a 788px) e trocar sozinha empurrava a
    // página inteira, com a pessoa lendo outra seção (achado 2026-10-17: o conteúdo abaixo do painel pulava ~400px).
    // Ali quem troca é o toque, e o que está embaixo não se mexe fora da vista.
    if (!autoplay || fixo || window.matchMedia("(max-width: 639px)").matches) return;
    const id = setInterval(() => {
      setAba((atual) => {
        const idx = abas.findIndex((a) => a.id === atual);
        return abas[(idx + 1) % abas.length]!.id;
      });
    }, INTERVALO_AUTOPLAY);
    return () => clearInterval(id);
  }, [autoplay, fixo]);

  function selecionarManual(id: AbaId) {
    setAba(id);
    setAutoplay(false);
    if (retomarTimeout.current) clearTimeout(retomarTimeout.current);
    // depois de um tempo sem interação, volta a navegar sozinho
    retomarTimeout.current = setTimeout(() => setAutoplay(true), 12000);
  }

  return (
    <section
      id="painel"
      ref={raiz}
      className="mx-auto max-w-6xl px-4 py-12 sm:py-20 sm:px-6 desk:max-w-[min(92rem,94vw)] desk:pr-6 desk:pl-10"
    >
      <Reveal className="mx-auto max-w-2xl text-center desk:max-w-4xl">
        <span className="text-sm font-semibold uppercase tracking-wide text-primary">
          Além do WhatsApp
        </span>
        <TituloDuasVozes
          antes="Um painel que cresce junto com"
          serifa="SUA OPERAÇÃO"
          className="mt-3 text-foreground sm:text-4xl lg:text-5xl desk:text-7xl"
        />
        <p className="mt-4 text-muted-foreground desk:mx-auto desk:mt-6 desk:max-w-2xl desk:text-lg">
          Preço, sinal de venda, alertas, lembretes, clima, janela de plantio e suporte, tudo num
          lugar só, desde o plano Bronze. Câmbio, diesel e boletins de mercado vêm junto.{" "}
          <span className="hidden [@media(pointer:fine)]:inline">
            Passe o mouse pra pausar e explorar no seu ritmo.
          </span>
          <span className="[@media(pointer:fine)]:hidden sm:hidden">
            Toque nos ícones pra explorar cada parte.
          </span>
        </p>
      </Reveal>

      <div
        ref={trilho}
        className="mt-12 desk:mt-16 desk:h-[calc(100vh+var(--vh-abas))] desk:xl:pl-[max(0px,calc(11.5rem-(100vw-min(92rem,94vw))/2-2.5rem))]"
        style={{ "--vh-abas": `${PESO_TOTAL * VH_POR_PESO}vh` } as React.CSSProperties}
      >
        <div className="relative desk:sticky desk:top-[11vh] desk:grid desk:grid-cols-[17rem_1fr] desk:items-center desk:gap-10 min-[1400px]:desk:grid-cols-[20rem_1fr] min-[1400px]:desk:gap-12 min-[1700px]:desk:grid-cols-[24rem_1fr]">
          {/* luz suave atrás do painel (só desktop): preenche a lateral sem objeto decorativo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-10 -inset-y-16 -z-10 hidden desk:block"
            style={{
              background:
                "radial-gradient(closest-side at 68% 50%, color-mix(in oklab, var(--cta) 16%, transparent), transparent), radial-gradient(closest-side at 22% 64%, color-mix(in oklab, var(--primary) 8%, transparent), transparent)",
            }}
          />
          {/* Legenda editorial do capítulo (só no desktop): número em serifa, título grande, abas do capítulo e progresso */}
          <div className="hidden desk:block" aria-hidden="true">
            <p
              className="flex items-baseline gap-3 leading-none text-[color:var(--cta)] italic"
              style={{ fontFamily: '"Instrument Serif", "Times New Roman", serif' }}
            >
              <span className="text-[7.5rem] tracking-tight">
                {String(capituloAtual + 1).padStart(2, "0")}
              </span>
              <span className="text-3xl text-muted-foreground not-italic">
                / {String(CAPITULOS.length).padStart(2, "0")}
              </span>
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={capituloAtual}
                initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <h3 className="mt-2 font-display text-5xl leading-[1.02] font-extrabold tracking-tight text-foreground text-balance">
                  {CAPITULOS[capituloAtual]!.titulo}
                </h3>
                <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                  {CAPITULOS[capituloAtual]!.texto}
                </p>
                {CAPITULOS[capituloAtual]!.abas.length > 1 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {CAPITULOS[capituloAtual]!.abas.map((id) => {
                      const item = abas.find((x) => x.id === id)!;
                      return (
                        <span
                          key={id}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-300",
                            id === aba
                              ? "border-[color:var(--cta)] bg-[color:var(--cta)]/12 text-foreground"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          <item.icon className="size-5" />
                          {item.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 flex gap-1.5">
              {CAPITULOS.map((c, i) => (
                <BarraDoCapitulo key={c.titulo} indice={i} progresso={progresso} />
              ))}
            </div>
            <p className="mt-5 text-xs tracking-wide text-muted-foreground uppercase">
              Role para percorrer o painel
            </p>
          </div>
          <Reveal delay={0.15} className="mx-auto w-full max-w-3xl desk:max-w-none">
            {/* dashboard-shell: escopa as MESMAS variáveis de cor/fonte do painel
            de verdade (sidebar verde-escuro, DM Sans, Space Grotesk nos
            títulos), em vez das cores da própria landing — era por isso que
            o preview nunca parecia o produto real, por mais que o conteúdo
            batesse. Pedido do Matheus 2026-10-12: "tem que ser FODA, o mais
            realista possível". */}
            {/* data-palco3d: no desktop o painel chega deitado em perspectiva e pousa; as camadas descolam e voltam */}
            <div data-palco3d="painel">
              <div
                data-spotlight
                className="dashboard-shell overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                onMouseEnter={() => setAutoplay(false)}
                onMouseLeave={() => setAutoplay(true)}
              >
                {/* barra de navegador, só decorativa */}
                <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
                  <span className="size-2.5 rounded-full bg-destructive/60" />
                  <span className="size-2.5 rounded-full bg-gold/50" />
                  <span className="size-2.5 rounded-full bg-primary/60" />
                  <span className="ml-3 rounded-md bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
                    app.safralume.com.br/dashboard
                  </span>
                </div>

                <motion.div
                  className="flex flex-col sm:flex-row"
                  style={fixo ? { scale: zoom, transformOrigin: "100% 0%" } : {}}
                >
                  {/* mini sidebar — mesma cor/estrutura da sidebar real (bg-sidebar
                verde-escuro, badge de logo, item ativo em sidebar-accent) */}
                  <div
                    ref={sidebarRef}
                    className="relative flex shrink-0 flex-col gap-1 border-b border-sidebar-border bg-sidebar p-2 sm:w-52 sm:border-r sm:border-b-0 sm:p-3"
                  >
                    <div className="mb-2 hidden items-center gap-2.5 px-1 pb-3 sm:flex">
                      <img src={MIDIA.logo} alt="" className="size-8 rounded-[0.6rem]" />
                      <div className="min-w-0">
                        <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
                          Safralume
                        </span>
                        <span className="block text-[10px] font-medium tracking-wide text-sidebar-foreground/55 uppercase">
                          Fazenda Santa Luzia
                        </span>
                      </div>
                    </div>

                    <CursorFantasma pos={cursorPos} />
                    <div data-camada="7" className="grid grid-cols-5 gap-1 sm:flex sm:flex-col">
                      {abas.map((item) => (
                        <button
                          key={item.id}
                          ref={(el) => {
                            botaoRefs.current[item.id] = el;
                          }}
                          type="button"
                          aria-label={item.label}
                          aria-pressed={aba === item.id}
                          onClick={() => selecionarManual(item.id)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors sm:gap-1.5 sm:px-2.5 sm:text-[13px] sm:tracking-tight pointer-coarse:min-h-11 pointer-coarse:min-w-11 sm:flex-none sm:justify-start",
                            aba === item.id
                              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                          )}
                        >
                          <item.icon className="size-6 shrink-0" />
                          <span className="hidden min-w-0 flex-1 truncate sm:inline">
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              "hidden shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:inline",
                              aba === item.id
                                ? "bg-sidebar-primary/25 text-sidebar-primary"
                                : planoBadge[item.plano].className,
                            )}
                          >
                            {planoBadge[item.plano].label}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 border-t border-sidebar-border px-3 pt-3 sm:hidden">
                      {abas.map((item) => (
                        <span
                          key={item.id}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            aba === item.id ? "bg-sidebar-primary" : "bg-sidebar-border",
                          )}
                        />
                      ))}
                    </div>

                    <div className="mt-auto hidden items-center gap-2 border-t border-sidebar-border px-1 pt-3 text-sidebar-foreground/55 sm:flex">
                      <LogOut className="size-3.5" />
                      <span className="text-xs">Sair</span>
                    </div>
                  </div>

                  {/* conteúdo, muda com a aba */}
                  <div className="min-h-96 flex-1 overflow-hidden bg-background p-4 sm:p-6">
                    <div data-camada="16">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={aba}
                          initial={{ opacity: 0, x: 14 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -14 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                          {aba === "precos" && <PreviewPrecos precosReais={precosReais} />}
                          {aba === "sinal" && <PreviewSinalVenda />}
                          {aba === "alertas" && <PreviewAlertas />}
                          {aba === "fazenda" && <PreviewFazenda />}
                          {aba === "estoque" && <PreviewEstoque />}
                          {aba === "clima" && <PreviewClima />}
                          {aba === "plantio" && <PreviewPlantio />}
                          {aba === "ferrugem" && <PreviewFerrugem />}
                          {aba === "insumos" && <PreviewInsumos />}
                          {aba === "leiloes" && <PreviewLeiloes />}
                          {aba === "suporte" && <PreviewSuporte />}
                          {aba === "acompanhamento" && <PreviewAcompanhamento />}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Prévia ilustrativa do painel
              {precosReais || exemplosDoDia?.comparativoSoja
                ? ", os preços da soja e o gráfico são reais (BBM), o resto é exemplo"
                : ", dados de exemplo"}
              . Recursos com selo{" "}
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 font-semibold text-zinc-700">
                Prata
              </span>{" "}
              ou{" "}
              <span className="rounded-full bg-gold px-1.5 py-0.5 font-semibold text-gold-foreground">
                Ouro
              </span>{" "}
              fazem parte desses planos,{" "}
              <a href="#planos" className="font-medium text-primary underline underline-offset-2">
                veja a comparação completa
              </a>
              .
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Barra de um capítulo que enche com a rolagem (como os stories): cheia nos que já passaram, vazia nos próximos. */
function BarraDoCapitulo({
  indice,
  progresso,
}: {
  indice: number;
  progresso: MotionValue<number>;
}) {
  const largura = useTransform(progresso, (v) => {
    const { c, dentro } = capituloDaRolagem(v);
    return `${c > indice ? 100 : c < indice ? 0 : Math.round(dentro * 100)}%`;
  });
  return (
    <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--cta)]"
        style={{ width: largura }}
      />
    </span>
  );
}

/** Cursor que se move até o item ativo (posição medida de verdade via
 * getBoundingClientRect, não um cálculo de índice × altura fixa) + um
 * pulso de "clique" que se repete a cada troca de aba — só desktop, onde a
 * sidebar é vertical e a metáfora de mouse faz sentido. */
function CursorFantasma({ pos }: { pos: { top: number; left: number } | null }) {
  if (!pos) return null;
  return (
    <motion.div
      className="pointer-events-none absolute z-30 hidden sm:block"
      animate={{ top: pos.top, left: pos.left }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ marginTop: -4, marginLeft: -4 }}
    >
      <MousePointer2 className="size-4 fill-foreground text-foreground drop-shadow-md" />
      <motion.span
        key={`${pos.top}-${pos.left}`}
        className="absolute top-1 left-1 size-2.5 rounded-full bg-primary"
        initial={{ scale: 0.5, opacity: 0.6 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </motion.div>
  );
}

function PreviewPrecos({
  precosReais,
}: {
  precosReais: { GO: number; MT: number; PR: number } | null;
}) {
  const exemplos = useExemplosDoDia();
  const serieSoja = exemplos?.serieSoja ?? null;
  // Preço REAL (BBM) das três praças, quando o servidor devolveu; senão os números ilustrativos de sempre.
  const [principal, segunda, terceira] = exemplos?.comparativoSoja ?? [];
  const real = !!(principal && segunda && terceira);
  const ufs: { uf: string; preco: number; variacao: number | null; cor: string }[] = [
    {
      uf: segunda?.uf ?? "MT",
      preco: segunda?.preco ?? precosReais?.MT ?? 129.8,
      variacao: real ? (segunda?.variacaoSemana ?? null) : 3.4,
      cor: "var(--chart-2)",
    },
    {
      uf: terceira?.uf ?? "PR",
      preco: terceira?.preco ?? precosReais?.PR ?? 130.8,
      variacao: real ? (terceira?.variacaoSemana ?? null) : -1.2,
      cor: "var(--chart-3)",
    },
  ];
  const sparklineDados =
    serieSoja && serieSoja.pontos.length >= 10
      ? serieSoja.pontos.slice(-24).map((p) => p.preco)
      : [118, 120, 119, 122, 124, 123, 126, 125, 127, 127];
  const precoHoje = principal?.preco ?? precosReais?.GO ?? 127;
  const variacaoHoje = real ? (principal?.variacaoSemana ?? null) : 0.8;
  return (
    <div className="flex flex-col gap-3">
      {/* cartão principal — o mesmo "Seu preço hoje" que abre o painel de
          verdade, com o mesmo glow radial no canto (ver dashboard/index.tsx) */}
      <Card className="spot-off rounded-xl border-border shadow relative overflow-hidden border-primary bg-primary py-4 text-primary-foreground shadow-lg">
        <div
          className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary-foreground/10 blur-3xl"
          aria-hidden="true"
        />
        <CardContent className="relative flex flex-wrap items-end justify-between gap-3 px-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <TrendingUp className="size-3" />
              Seu preço hoje
            </p>
            <div className="mt-1 flex items-end gap-2">
              <p className="font-mono text-3xl font-semibold tabular-nums">
                <span className="mr-0.5 align-top text-sm font-sans font-semibold opacity-70">
                  R$
                </span>
                <AnimatedNumber value={precoHoje} />
              </p>
              {variacaoHoje != null && (
                <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold">
                  {variacaoHoje >= 0 ? (
                    <ArrowUp className="size-2.5" />
                  ) : (
                    <ArrowDown className="size-2.5" />
                  )}
                  {Math.abs(variacaoHoje).toFixed(1).replace(".", ",")}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs opacity-80">
              {real
                ? `Soja · ${principal.praca} (${principal.uf})`
                : "Soja · GO · preço na sua região"}
            </p>
          </div>
          <div className="w-24">
            <Sparkline data={sparklineDados} color="currentColor" className="h-9 w-full" />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs font-semibold text-muted-foreground">Compare com outros estados</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ufs.map((item) => (
          <Card key={item.uf} className="spot-off rounded-xl border-border shadow gap-1.5 py-3">
            <CardContent className="px-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: item.cor }} />
                SOJA · {item.uf}
              </div>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
                <span className="mr-0.5 align-top text-xs font-sans text-muted-foreground">R$</span>
                <AnimatedNumber value={item.preco} />
              </p>
              {item.variacao != null && (
                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    item.variacao >= 0
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-red-800",
                  )}
                >
                  {item.variacao >= 0 ? (
                    <ArrowUp className="size-2.5" />
                  ) : (
                    <ArrowDown className="size-2.5" />
                  )}
                  {Math.abs(item.variacao).toFixed(1).replace(".", ",")}% sem.
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Só desktop: o painel real tem um histórico, e esta janela grande ficava com a metade de baixo vazia. */}
      {serieSoja && serieSoja.pontos.length >= 10 && (
        <GraficoPrecoReal
          serie={serieSoja.pontos}
          titulo={`Soja · ${serieSoja.praca} · últimos 90 dias`}
        />
      )}
    </div>
  );
}

function PreviewAlertas() {
  // Data do alerta "disparado" é relativa a hoje (nunca fixa) e o dólar é a
  // PTAX real do dia, senão o exemplo envelhece e destoa do dado de verdade.
  const hoje = useHoje();
  const dolar = useExemplosDoDia()?.dolar;
  const alertas = [
    { texto: "Soja · MT acima de R$ 130,00", status: "Ativo, aguardando" },
    {
      texto: "Milho · GO abaixo de R$ 60,00",
      status: hoje ? `Disparado em ${haDiasAtras(hoje, 4)}` : "Disparado há 4 dias",
    },
  ];
  const lembretes = [
    { titulo: "Aplicar fungicida na soja", quando: "Amanhã, 07:00" },
    { titulo: "Renovar seguro da frota", quando: "Toda semana, seg." },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Alertas de preço</p>
      <div className="flex flex-col gap-2">
        {alertas.map((a) => (
          <div
            key={a.texto}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-2 text-sm text-foreground">
              <TrendingUp className="size-4 shrink-0 text-primary" />
              {a.texto}
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {a.status}
            </Badge>
          </div>
        ))}
      </div>

      <p className="mt-1 text-sm font-semibold text-foreground">Lembretes</p>
      <div className="flex flex-col gap-2">
        {lembretes.map((l) => (
          <div
            key={l.titulo}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-primary" />
              {l.titulo}
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{l.quando}</span>
          </div>
        ))}
      </div>

      <p className="mt-1 text-sm font-semibold text-foreground">Contexto de mercado</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
          <DollarSign className="size-4 shrink-0 text-primary" />
          Dólar (PTAX):{" "}
          <span className="font-mono font-semibold">
            {dolar ? `R$ ${brl2(dolar.valor)}` : "cotação do dia"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
          <Fuel className="size-4 shrink-0 text-primary" />
          Diesel em MT: <span className="font-mono font-semibold">R$ 6,65/L</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
          <Globe className="size-4 shrink-0 text-primary" />
          Produção de soja (IBGE): <span className="font-mono font-semibold">180,5 mi t</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
          <BadgeCheck className="size-4 shrink-0 text-primary" />
          Boletim Imea + USDA: <span className="font-semibold">atualizado essa semana</span>
        </div>
      </div>
    </div>
  );
}

function PreviewFazenda() {
  const resumo = [
    { rotulo: "Gastos", valor: "R$ 18.400", cor: "text-foreground" },
    { rotulo: "Vendas", valor: "R$ 67.500", cor: "text-foreground" },
    { rotulo: "Resultado", valor: "R$ 49.100", cor: "text-primary" },
  ];
  const lancamentos = [
    { quando: "Hoje", texto: "Adubo, talhão 3", valor: "− R$ 12.000", via: "WhatsApp" },
    { quando: "Ontem", texto: "Nota do posto (foto)", valor: "− R$ 2.970", via: "WhatsApp" },
    { quando: "15/out", texto: "Plantio de milho", valor: "", via: "Painel" },
  ];
  const aReceber = {
    texto: "Soja, 500 sacas a R$ 135",
    venc: "vence em 9 dias, 30/10",
    valor: "R$ 67.500",
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {resumo.map((r) => (
          <div key={r.rotulo} className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">{r.rotulo}</p>
            <p className={`font-mono text-sm font-semibold tabular-nums sm:text-base ${r.cor}`}>
              {r.valor}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-primary">A receber · te lembro às 8h</p>
          <p className="truncate text-sm text-foreground">{aReceber.texto}</p>
          <p className="text-[11px] text-muted-foreground">{aReceber.venc}</p>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
          {aReceber.valor}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">Últimos lançamentos</p>
      <div className="flex flex-col gap-2">
        {lancamentos.map((l) => (
          <div
            key={l.texto}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{l.texto}</p>
              <p className="text-[11px] text-muted-foreground">
                {l.quando} · {l.via}
              </p>
            </div>
            {l.valor && (
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                {l.valor}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
        No WhatsApp é só escrever, mandar áudio ou a foto da nota. Diga “custo por saca” e veja a
        sua margem.
      </p>
    </div>
  );
}

function PreviewEstoque() {
  const dados = [
    { rotulo: "Estoque", valor: "8.000 sc", nota: "contagem + colheitas − vendas" },
    { rotulo: "Custo por saca", valor: "R$ 60,00", nota: "com o que você lançou" },
    { rotulo: "Preço-alvo", valor: "R$ 80,00", nota: "para 25% de margem" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {dados.map((d) => (
          <div key={d.rotulo} className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">{d.rotulo}</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground sm:text-base">
              {d.valor}
            </p>
            <p className="text-[10px] leading-tight text-muted-foreground">{d.nota}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-[11px] font-medium text-primary">Aviso no WhatsApp</p>
        <p className="mt-1 text-sm text-foreground">
          A soja chegou a R$ 136,38. Pelo seu custo de R$ 60,00 por saca, sua margem está em 56%,
          acima da meta de 25%. Você tem cerca de 8.000 sacas sem vender.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
        <span className="text-foreground">Meta de margem</span>
        <span className="font-mono font-semibold text-foreground">25%</span>
        <Badge variant="secondary" className="text-[10px]">
          Avisar no WhatsApp: ligado
        </Badge>
      </div>
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
        Seus funcionários também anotam gasto, plantio e colheita pelo WhatsApp, direto no seu
        caderno. Conta com o que você lançou, não é recomendação de venda.
      </p>
    </div>
  );
}

function PreviewClima() {
  const dias = [
    { dia: "hoje", chuva: 24, tempMin: 28, tempMax: 38 },
    { dia: "amanhã", chuva: 10, tempMin: 28, tempMax: 39 },
    { dia: "seg.", chuva: 2, tempMin: 28, tempMax: 40 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Previsão · Rio Verde/GO</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {dias.map((d) => (
          <Card key={d.dia} className="spot-off rounded-xl border-border shadow gap-1.5 py-3">
            <CardContent className="flex flex-col items-center gap-1 px-3 text-center">
              <p className="text-xs font-semibold text-muted-foreground capitalize">{d.dia}</p>
              <CloudSun className="size-6 text-primary" />
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {d.tempMin}°–{d.tempMax}°C
              </p>
              <p className="text-xs text-muted-foreground">{d.chuva}% de chuva</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
        <Globe className="size-4 shrink-0 text-primary" />
        Produção de soja em GO (IBGE): <span className="font-semibold">50,6 mi t</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Além da sua cidade, acompanhe quantos outros estados quiser. Útil pra quem opera em mais de
        uma região.
      </p>
    </div>
  );
}

function PreviewSinalVenda() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Sinal de venda</p>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm text-foreground">
              Preço bem posicionado nos últimos 90 dias e o mercado futuro não aponta mais alta.
              Pode ser um bom momento pra vender.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Cruza a posição do preço nos últimos 90 dias, a curva de futuros da B3 e o risco de
              clima na sua região.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
        <Bell className="size-4 shrink-0 text-primary" />
        Quando o sinal muda pra "bom momento pra vender", você recebe também no WhatsApp.
      </div>
    </div>
  );
}

function PreviewPlantio() {
  // Janelas reais do ZARC pra Sorriso/MT quando o dado chega; sem ele, os
  // decêndios são calculados a partir de hoje (nunca meses fixos) e o risco
  // fica de fora em vez de inventar um número.
  const hoje = useHoje();
  const plantio = useExemplosDoDia()?.plantio;
  const janelas: { periodo: string; risco: number | null }[] = plantio
    ? [{ periodo: plantio.periodoAtual, risco: plantio.riscoHoje }, ...plantio.proximas.slice(1, 4)]
    : proximosDecendios(hoje ?? new Date(), 4).map((periodo) => ({
        periodo,
        risco: null,
      }));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Janela de plantio · Soja · Sorriso/MT</p>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-2">
          <Sprout className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm text-foreground">
              Agora ({janelas[0]!.periodo}):{" "}
              <span className="font-semibold">
                {janelas[0]!.risco != null ? `${janelas[0]!.risco}% de risco` : "risco no painel"}
              </span>
              .
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Risco climático oficial do ZARC/MAPA, direto do zoneamento da safra vigente.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground">Próximas janelas</p>
      <div className="flex flex-col gap-2">
        {janelas.slice(1).map((j) => (
          <div
            key={j.periodo}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm text-foreground"
          >
            {j.periodo}
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              {j.risco != null ? `${j.risco}% de risco` : "risco no painel"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        Progresso da semana (Conab)
      </p>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
        Soja semeada no PR
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
          15% · média 5 anos 12,6%
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Soja, milho, algodão, arroz e feijão. Não é estimativa de produtividade, só risco climático
        da época de plantio.
      </p>
    </div>
  );
}

function PreviewSuporte() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Seus chamados</p>
      <div className="flex flex-col gap-2">
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Preço da soja não atualizou hoje</p>
            <Badge className="shrink-0 gap-1 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">
              <CheckCircle2 className="size-3" />
              Respondido
            </Badge>
          </div>
          <p className="mt-2 rounded-md bg-secondary/60 p-2 text-xs text-muted-foreground">
            Já corrigimos o problema, o preço da soja deve atualizar até amanhã de manhã.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">Dúvida sobre o valor do frete calculado</p>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Aberto
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
        <LifeBuoy className="size-4 shrink-0 text-primary" />
        Abra um chamado direto no painel. A resposta chega no WhatsApp.
      </div>
    </div>
  );
}

function PreviewAcompanhamento() {
  const itens = [
    { cultura: "Milho", uf: "MT", preco: "72,10", variacao: 1.4 },
    { cultura: "Café Arábica", uf: "ES", preco: "1.773,33", variacao: -2.1 },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold/50 bg-gold-soft/40 p-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">Lista de acompanhamento</p>
        <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-semibold text-gold-foreground">
          Ouro
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Siga outras culturas e estados além do seu principal. Útil pra consultor ou produtor que
        opera em mais de uma frente.
      </p>
      <div className="flex flex-col gap-2">
        {itens.map((item) => (
          <Card
            key={item.cultura}
            className="spot-off rounded-xl border-border shadow gap-1 border-gold/40 py-3"
          >
            <CardContent className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Star className="size-4 shrink-0 text-gold-foreground" />
                {item.cultura} · {item.uf}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  R$ {item.preco}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    item.variacao > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-red-800",
                  )}
                >
                  {item.variacao > 0 ? (
                    <ArrowUp className="size-2.5" />
                  ) : (
                    <ArrowDown className="size-2.5" />
                  )}
                  {Math.abs(item.variacao)}%
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PreviewFerrugem() {
  const municipios = ["Campo Novo do Parecis", "Primavera do Leste", "Nova Mutum"];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-center gap-2">
        <Bug className="size-4 shrink-0 text-destructive" />
        <p className="text-sm font-semibold text-foreground">Ferrugem asiática · Soja · MT</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Foco confirmado em {municipios.length} municípios da sua safra, segundo o Consórcio
        Antiferrugem.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {municipios.map((m) => (
          <span
            key={m}
            className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-red-800"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewLeiloes() {
  const leiloes = [
    { titulo: "16º Leilão Nelore WS", local: "Alta Floresta/MT", data: "10/out · 14h" },
    { titulo: "Leilão Grupo Rezende", local: "Virtual · nacional", data: "17/out · 13h" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-300/60 bg-zinc-100/60 p-3 dark:border-zinc-700/50 dark:bg-zinc-800/30">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">Agenda de leilão</p>
        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-700">
          Prata
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Leilão presencial na sua região e leilão virtual em destaque, no Brasil inteiro.
      </p>
      <div className="flex flex-col gap-2">
        {leiloes.map((l) => (
          <Card
            key={l.titulo}
            className="spot-off rounded-xl border-border shadow gap-1 border-zinc-300/60 py-3 dark:border-zinc-700/50"
          >
            <CardContent className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Gavel className="size-4 shrink-0 text-zinc-500" />
                <div className="flex flex-col">
                  <span>{l.titulo}</span>
                  <span className="text-xs text-muted-foreground">{l.local}</span>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                {l.data}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PreviewInsumos() {
  const itens = [
    { rotulo: "Herbicida", faixa: "R$ 28,17 – 66,83", unidade: "/L" },
    { rotulo: "Fertilizante", faixa: "R$ 2.410,00 – 3.155,11", unidade: "/t" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-300/60 bg-zinc-100/60 p-3 dark:border-zinc-700/50 dark:bg-zinc-800/30">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">Preço de insumos</p>
        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-700">
          Prata
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Faixa de preço de defensivos e fertilizantes por marca, no seu estado, direto da Conab.
      </p>
      <div className="flex flex-col gap-2">
        {itens.map((item) => (
          <Card
            key={item.rotulo}
            className="spot-off rounded-xl border-border shadow gap-1 border-zinc-300/60 py-3 dark:border-zinc-700/50"
          >
            <CardContent className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <FlaskConical className="size-4 shrink-0 text-zinc-500" />
                {item.rotulo}
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {item.faixa}
                <span className="ml-0.5 font-sans text-xs font-normal text-muted-foreground">
                  {item.unidade}
                </span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
