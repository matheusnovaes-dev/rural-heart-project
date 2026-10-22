import { useEffect, useRef } from "react";

import { MAPA_BRASIL } from "@/components/landing/mapaBrasilPath";
import { ESTADOS_DAS_FONTES, SEDES } from "@/components/landing/desktop/mapaFontes";
import { useExemplosDoDia } from "@/hooks/useExemplosDoDia";
import { brl2, diaMes } from "@/lib/exemplosLanding";

/**
 * "O caminho do dado" (só desktop, no lugar da foto da seção de fontes): o mapa do Brasil deitado em perspectiva, como
 * numa mesa de comando. Ao rolar, cada fonte acende no estado onde fica a sua sede, sobe um feixe de luz e uma linha
 * leva até a resposta do WhatsApp com o número real do dia (a linha da fonte daquele número fica dourada). Passar o
 * mouse num selo de fonte do texto ao lado acende o estado dela. Tudo é guiado pelo scroll (vai e volta) e roda num
 * laço próprio só enquanto o mapa está na tela; nada aqui re-renderiza o React por quadro.
 */

type Uf = keyof typeof SEDES;
type Fonte = {
  id: string;
  uf: Uf;
  rotulo: string;
  /** Nomes dos selos do texto ao lado que acendem esta fonte */
  selos: string[];
  /** Altura do feixe (px, antes da perspectiva) */
  altura: number;
  /** Lado do rótulo em relação ao topo do feixe */
  lado: 1 | -1;
};

const FONTES: Fonte[] = [
  { id: "conab", uf: "DF", rotulo: "Conab · todo o país", selos: ["Conab"], altura: 250, lado: 1 },
  { id: "imea", uf: "MT", rotulo: "Imea · MT", selos: ["Imea"], altura: 175, lado: -1 },
  {
    id: "conseleite",
    uf: "MG",
    rotulo: "Conseleite · MG",
    selos: ["Conseleite"],
    altura: 195,
    lado: 1,
  },
  {
    id: "sp",
    uf: "SP",
    rotulo: "BBM · B3 · IEA-SP",
    selos: ["BBM", "B3", "IEA-SP"],
    altura: 140,
    lado: 1,
  },
  { id: "deral", uf: "PR", rotulo: "Deral · PR", selos: ["Deral/PR"], altura: 165, lado: -1 },
  { id: "epagri", uf: "SC", rotulo: "Epagri · SC", selos: ["Epagri/SC"], altura: 95, lado: 1 },
  { id: "emater", uf: "RS", rotulo: "Emater · RS", selos: ["Emater/RS"], altura: 150, lado: -1 },
];
/** A fonte do número mostrado na resposta (preço BBM de Sorriso/MT): a linha dela fica dourada. */
const FONTE_DO_NUMERO = "sp";

const VB = { x: -20, y: -20, w: 1040, h: 1066 };
const pct = (v: number, ini: number, tam: number) => `${((v - ini) / tam) * 100}%`;
const suave = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const OURO = "oklch(0.84 0.15 85)";

export default function CaminhoDoDado() {
  const palco = useRef<HTMLDivElement>(null);
  const mesa = useRef<HTMLDivElement>(null);
  const contorno = useRef<SVGPathElement>(null);
  const estados = useRef<Record<string, SVGPathElement | null>>({});
  const bases = useRef<Record<string, SVGGElement | null>>({});
  const feixes = useRef<Record<string, HTMLDivElement | null>>({});
  const topos = useRef<Record<string, HTMLSpanElement | null>>({});
  const rotulos = useRef<Record<string, HTMLDivElement | null>>({});
  const linhas = useRef<Record<string, SVGPathElement | null>>({});
  const faiscas = useRef<Record<string, SVGCircleElement | null>>({});
  const cartao = useRef<HTMLDivElement>(null);
  const ancora = useRef<HTMLSpanElement>(null);

  const exemplos = useExemplosDoDia();
  const praca = exemplos?.comparativoSoja?.find((p) => p.uf === "MT") ?? null;

  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    let visivel = false;
    let raf = 0;
    let ativo: string | null = null;
    const mouse = { x: 0, y: 0, ax: 0, ay: 0 };
    const luz: Record<string, number> = {};
    FONTES.forEach((f) => (luz[f.id] = 0));

    const io = new IntersectionObserver(
      ([e]) => {
        visivel = !!e?.isIntersecting;
        if (visivel && !raf) raf = requestAnimationFrame(quadro);
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(el);

    const aoMover = (ev: PointerEvent) => {
      if (ev.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const dentro =
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom;
      mouse.ax = dentro ? (ev.clientX - r.left) / r.width - 0.5 : 0;
      mouse.ay = dentro ? (ev.clientY - r.top) / r.height - 0.5 : 0;
    };
    // Selos de fonte do texto ao lado (data-fonte="Imea" etc.): passar o mouse acende a fonte no mapa
    const aoPassar = (ev: PointerEvent) => {
      const selo = (ev.target as Element | null)?.closest?.<HTMLElement>("[data-fonte]");
      const nome = selo?.dataset["fonte"];
      ativo = nome ? (FONTES.find((f) => f.selos.includes(nome))?.id ?? null) : null;
    };
    window.addEventListener("pointermove", aoMover, { passive: true });
    document.addEventListener("pointerover", aoPassar, { passive: true });

    const t0 = performance.now();
    function quadro(agora: number) {
      raf = 0;
      if (!visivel || !el) return;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      // 0 quando o topo do mapa encosta no pé da tela; 1 quando ele chega perto do topo
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.95)));
      mouse.x += (mouse.ax - mouse.x) * 0.07;
      mouse.y += (mouse.ay - mouse.y) * 0.07;

      // mesa: chega mais deitada e longe, assenta e segue o mouse de leve
      const chegada = suave(p / 0.5);
      const f = 1 - chegada;
      if (mesa.current) {
        mesa.current.style.transform = `translate3d(0,${(f * 90).toFixed(1)}px,${(-f * 260).toFixed(1)}px) rotateX(${(56 + f * 16 - mouse.y * 6).toFixed(2)}deg) rotateZ(${(-14 + f * -10 + mouse.x * 8).toFixed(2)}deg)`;
      }
      // contorno do país se desenha
      contorno.current?.setAttribute("stroke-dashoffset", (1 - suave((p - 0.04) / 0.4)).toFixed(4));

      const pr = el.getBoundingClientRect();
      const a = ancora.current?.getBoundingClientRect();
      const ax = a ? a.left - pr.left : 0;
      const ay = a ? a.top - pr.top : 0;
      const tempo = (agora - t0) / 1000;

      FONTES.forEach((fonte, k) => {
        const alvo = suave((p - (0.34 + k * 0.045)) / 0.1);
        // fonte destacada pelo selo: as outras recuam
        const foco = ativo ? (ativo === fonte.id ? 1.35 : 0.35) : 1;
        luz[fonte.id] = luz[fonte.id]! + (alvo * foco - luz[fonte.id]!) * 0.15;
        const l = luz[fonte.id]!;
        const aceso = Math.min(1, l);
        const estado = estados.current[fonte.id];
        if (estado) {
          estado.style.fillOpacity = (aceso * (ativo === fonte.id ? 0.42 : 0.2)).toFixed(3);
          estado.style.strokeOpacity = (aceso * 0.95).toFixed(3);
        }
        const base = bases.current[fonte.id];
        if (base) base.style.opacity = aceso.toFixed(3);
        const feixe = feixes.current[fonte.id];
        if (feixe) {
          feixe.style.transform = `rotateX(-90deg) scaleY(${Math.max(0.001, aceso).toFixed(3)})`;
          feixe.style.opacity = (0.35 + aceso * 0.65 * Math.min(l, 1.2)).toFixed(3);
        }
        // topo do feixe projetado na tela: rótulo e começo da linha
        const topo = topos.current[fonte.id]?.getBoundingClientRect();
        if (!topo) return;
        const tx = topo.left - pr.left;
        const ty = topo.top - pr.top;
        const rot = rotulos.current[fonte.id];
        if (rot) {
          rot.style.transform = `translate(${(tx + (fonte.lado === 1 ? 10 : -10)).toFixed(1)}px, ${(ty - 10).toFixed(1)}px) translateX(${fonte.lado === 1 ? "0" : "-100%"})`;
          rot.style.opacity = (aceso * (ativo && ativo !== fonte.id ? 0.4 : 1)).toFixed(3);
        }
        const linha = linhas.current[fonte.id];
        const traco = suave((p - (0.56 + k * 0.03)) / 0.12);
        if (linha) {
          const cx1 = tx;
          const cy1 = ty - 70;
          const cx2 = ax - 80;
          const cy2 = ay + 40;
          linha.setAttribute(
            "d",
            `M${tx.toFixed(1)} ${ty.toFixed(1)} C${cx1.toFixed(1)} ${cy1.toFixed(1)} ${cx2.toFixed(1)} ${cy2.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}`,
          );
          linha.style.strokeDashoffset = (1 - traco).toFixed(4);
          linha.style.opacity = (ativo && ativo !== fonte.id ? 0.25 : 1).toFixed(2);
        }
        const faisca = faiscas.current[fonte.id];
        if (faisca && linha) {
          if (traco >= 0.99) {
            const len = linha.getTotalLength();
            const fase = (tempo * 0.35 + k * 0.17) % 1;
            const pt = linha.getPointAtLength(len * fase);
            faisca.setAttribute("cx", pt.x.toFixed(1));
            faisca.setAttribute("cy", pt.y.toFixed(1));
            faisca.style.opacity = (Math.sin(fase * Math.PI) * 0.95).toFixed(3);
          } else faisca.style.opacity = "0";
        }
      });

      const c = suave((p - 0.62) / 0.12);
      if (cartao.current) {
        cartao.current.style.opacity = c.toFixed(3);
        cartao.current.style.transform = `translateY(${((1 - c) * 24).toFixed(1)}px) scale(${(0.96 + c * 0.04).toFixed(3)})`;
        cartao.current.style.filter = c > 0.98 ? "" : `blur(${((1 - c) * 8).toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(quadro);
    }

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerover", aoPassar);
    };
  }, []);

  return (
    <div
      ref={palco}
      aria-hidden="true"
      className="relative h-[36rem] w-full select-none"
      style={{ perspective: "1500px", perspectiveOrigin: "50% 15%" }}
    >
      {/* Mesa: o mapa e os feixes no mesmo plano 3D */}
      <div
        ref={mesa}
        className="absolute top-[20%] left-[-2%] aspect-[1040/1066] w-[102%] will-change-transform"
        style={{ transformStyle: "preserve-3d", transformOrigin: "50% 55%" }}
      >
        <svg
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className="absolute inset-0 size-full overflow-visible"
        >
          <g stroke="white" strokeOpacity={0.05} strokeWidth={1}>
            {Array.from({ length: 11 }, (_, i) => (
              <line key={`v${i}`} x1={i * 100} y1={-20} x2={i * 100} y2={1046} />
            ))}
            {Array.from({ length: 11 }, (_, i) => (
              <line key={`h${i}`} x1={-20} y1={i * 100} x2={1020} y2={i * 100} />
            ))}
          </g>
          <path d={MAPA_BRASIL.pais} fill="oklch(0.26 0.045 157)" />
          <path
            d={MAPA_BRASIL.ufs}
            fill="none"
            stroke="white"
            strokeOpacity={0.1}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {FONTES.map((f) => (
            <path
              key={f.id}
              ref={(n) => {
                estados.current[f.id] = n;
              }}
              d={ESTADOS_DAS_FONTES[f.uf]}
              fill={OURO}
              stroke={OURO}
              strokeWidth={2.2}
              strokeLinejoin="round"
              style={{ fillOpacity: 0, strokeOpacity: 0 }}
            />
          ))}
          <path
            ref={contorno}
            d={MAPA_BRASIL.pais}
            fill="none"
            stroke="oklch(0.9 0.08 120)"
            strokeOpacity={0.55}
            strokeWidth={2.4}
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1}
          />
          {FONTES.map((f) => {
            const [x, y] = SEDES[f.uf];
            return (
              <g
                key={f.id}
                ref={(n) => {
                  bases.current[f.id] = n;
                }}
                style={{ opacity: 0 }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={26}
                  fill={OURO}
                  opacity={0.14}
                  className="mapa-pino-pulso"
                />
                <circle cx={x} cy={y} r={9} fill={OURO} />
              </g>
            );
          })}
        </svg>

        {FONTES.map((f) => {
          const [x, y] = SEDES[f.uf];
          return (
            <div
              key={f.id}
              ref={(n) => {
                feixes.current[f.id] = n;
              }}
              className="absolute w-[4px]"
              style={{
                left: pct(x, VB.x, VB.w),
                top: `calc(${pct(y, VB.y, VB.h)} - ${f.altura}px)`,
                height: f.altura,
                marginLeft: -2,
                transformOrigin: "50% 100%",
                transform: "rotateX(-90deg) scaleY(0.001)",
                background: `linear-gradient(to top, ${OURO}, oklch(0.84 0.15 85 / 0.55) 55%, transparent)`,
                boxShadow: "0 0 14px 2px oklch(0.84 0.15 85 / 0.45)",
                borderRadius: 4,
              }}
            >
              <span
                ref={(n) => {
                  topos.current[f.id] = n;
                }}
                className="absolute top-0 left-1/2 size-px"
              />
            </div>
          );
        })}
      </div>

      {/* Linhas e faíscas no plano da tela, do topo de cada feixe até a resposta */}
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {FONTES.map((f) => (
          <g key={f.id}>
            <path
              ref={(n) => {
                linhas.current[f.id] = n;
              }}
              fill="none"
              stroke={f.id === FONTE_DO_NUMERO ? OURO : "white"}
              strokeOpacity={f.id === FONTE_DO_NUMERO ? 0.95 : 0.28}
              strokeWidth={f.id === FONTE_DO_NUMERO ? 2 : 1.2}
              pathLength={1}
              strokeDasharray="1 1"
              style={{ strokeDashoffset: 1 }}
            />
            <circle
              ref={(n) => {
                faiscas.current[f.id] = n;
              }}
              r={f.id === FONTE_DO_NUMERO ? 3.5 : 2.5}
              fill={f.id === FONTE_DO_NUMERO ? OURO : "white"}
              style={{ opacity: 0 }}
            />
          </g>
        ))}
      </svg>

      {FONTES.map((f) => (
        <div
          key={f.id}
          ref={(n) => {
            rotulos.current[f.id] = n;
          }}
          className="pointer-events-none absolute top-0 left-0 rounded-md border border-white/15 bg-[oklch(0.2_0.035_157/0.85)] px-2 py-1 font-mono text-[10px] font-medium tracking-[0.14em] whitespace-nowrap text-white/90 uppercase shadow-lg"
          style={{ opacity: 0 }}
        >
          <span
            className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
            style={{ background: OURO }}
          />
          {f.rotulo}
        </div>
      ))}

      {/* A resposta: onde todas as linhas chegam */}
      <div
        ref={cartao}
        className="absolute top-0 right-[2%] w-[17.5rem] rounded-2xl border border-white/15 bg-[oklch(0.2_0.035_157/0.92)] p-4 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]"
        style={{ opacity: 0 }}
      >
        <span ref={ancora} className="absolute top-1/2 left-0 size-px" />
        <p className="font-mono text-[10px] tracking-[0.18em] text-white/55 uppercase">
          Resposta no WhatsApp
        </p>
        <p className="mt-2 text-sm leading-snug text-white">
          Soja em Sorriso/MT hoje:{" "}
          <span className="font-mono text-lg font-semibold whitespace-nowrap">
            {praca ? `R$ ${brl2(praca.preco)}` : "preço do dia"}
          </span>{" "}
          a saca.
        </p>
        <p
          className="mt-3 border-t border-white/10 pt-2 font-mono text-[10.5px] tracking-[0.14em] uppercase"
          style={{ color: OURO }}
        >
          Fonte: BBM{praca ? ` · ${diaMes(praca.data)}` : ""}
        </p>
      </div>
    </div>
  );
}
