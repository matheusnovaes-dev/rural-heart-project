import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useScroll } from "framer-motion";

import type { SecaoLegal } from "@/components/landing/PaginaLegal";
import type { Progresso } from "./Cena";

const Cena = lazy(() => import("./Cena"));

/** Se o 3D falhar (sem WebGL, placa que perde o contexto), volta para o texto corrido sem quebrar a página. */
class Protecao extends Component<{ aoFalhar: () => void; children: ReactNode }, { erro: boolean }> {
  override state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  override componentDidCatch() {
    this.props.aoFalhar();
  }
  override render() {
    return this.state.erro ? null : this.props.children;
  }
}

/**
 * Leitura em espiral 3D das páginas legais (referência: a página "work" do Active Theory). No centro, uma árvore esculpida em
 * metal dourado iridescente cresce da raiz à copa conforme a leitura avança; em volta dela, as seções são placas de vidro
 * numa hélice que gira com a rolagem. O texto completo da seção da frente fica num painel de leitura em HTML à esquerda
 * (legível, selecionável, acessível). Three.js + React Three Fiber + Drei + pós-processamento (brilho, granulado, vinheta).
 *
 * Só desktop, carregado sob demanda por PaginaLegal: o celular e a landing nunca baixam nada disto. O texto corrido continua
 * no HTML do servidor (busca, leitores de tela, impressão, revisão da Meta) e o botão "Ler em texto corrido" volta para ele.
 */
export default function EspiralLegal3D({
  secoes,
  aoSair,
}: {
  secoes: SecaoLegal[];
  aoSair: () => void;
}) {
  const palco = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: palco, offset: ["start start", "end end"] });
  const progresso = useMemo<Progresso>(() => ({ atual: 0 }), []);
  const [ativa, setAtiva] = useState(0);
  const n = secoes.length;
  const titulos = useMemo(() => secoes.map((s) => s.titulo), [secoes]);

  useEffect(() => {
    const aplicar = (v: number) => {
      progresso.atual = v;
      const i = Math.round(v * (n - 1));
      setAtiva((a) => (a === i ? a : i));
    };
    aplicar(scrollYProgress.get());
    return scrollYProgress.on("change", aplicar);
  }, [scrollYProgress, progresso, n]);

  const irPara = (i: number) => {
    const el = palco.current;
    if (!el) return;
    const topo = el.getBoundingClientRect().top + window.scrollY;
    const curso = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: topo + (curso * i) / Math.max(1, n - 1), behavior: "smooth" });
  };

  const s = secoes[ativa]!;
  return (
    <div
      ref={palco}
      className="relative bg-[#06120c] text-primary-foreground"
      style={{ height: `${n * 75 + 100}vh` }}
    >
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
        <div className="absolute inset-0">
          <Protecao aoFalhar={aoSair}>
            <Suspense fallback={null}>
              <Cena titulos={titulos} progresso={progresso} />
            </Suspense>
          </Protecao>
        </div>

        {/* painel de leitura: o texto completo da seção da frente */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[44%] items-center pl-28 xl:pl-36">
          <article
            key={s.id}
            aria-live="polite"
            className="legal3d-entra pointer-events-auto max-w-[30rem] rounded-3xl border border-white/12 bg-[#081a12]/70 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-md"
          >
            <p className="font-mono text-[11px] font-semibold tracking-[0.22em] text-[#f2d39b] uppercase">
              {String(ativa + 1).padStart(2, "0")} / {String(n).padStart(2, "0")} -&gt; seção
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">{s.titulo}</h2>
            <div className="mt-4 text-[15px] leading-relaxed text-primary-foreground/80 [&_a]:underline [&_p+p]:mt-3">
              {s.corpo}
            </div>
          </article>
        </div>

        <nav aria-label="Seções" className="absolute top-1/2 left-8 z-10 -translate-y-1/2">
          <ul className="flex flex-col gap-1">
            {secoes.map((sec, i) => (
              <li key={sec.id}>
                <button
                  type="button"
                  onClick={() => irPara(i)}
                  aria-current={i === ativa ? "true" : undefined}
                  className={`py-1 font-mono text-[11px] tracking-[0.18em] transition-colors hover:text-primary-foreground ${i === ativa ? "text-[color:var(--cta)]" : "text-primary-foreground/40"}`}
                  title={sec.titulo}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          onClick={aoSair}
          className="absolute right-8 bottom-8 z-10 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase backdrop-blur transition-colors hover:bg-white/20"
        >
          Ler em texto corrido -&gt;
        </button>
        <p
          aria-hidden="true"
          className="absolute bottom-9 left-8 font-mono text-[10px] tracking-[0.22em] text-primary-foreground/40 uppercase"
        >
          Role para ler
        </p>
      </div>
    </div>
  );
}
