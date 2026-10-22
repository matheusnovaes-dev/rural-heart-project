import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

import { MAPA_BRASIL } from "@/components/landing/mapaBrasilPath";
import { SEDES } from "@/components/landing/desktop/mapaFontes";
import { useExemplosDoDia } from "@/hooks/useExemplosDoDia";
import { brl2, diaMes } from "@/lib/exemplosLanding";
import { criarPrograma } from "./gl";
import { nivelDaMaquina } from "./qualidade";

/**
 * "Do grão ao número" (só desktop, abre o capítulo das fontes): milhares de grãos de luz soltos na tela, como os números
 * públicos espalhados pelo país; ao rolar, eles voam e formam o mapa do Brasil (as sedes das fontes brilham), e depois
 * se reorganizam no preço de verdade do dia (soja em Sorriso/MT, BBM). Inspirado nos mundos de partículas do Active
 * Theory, mas contando a história do produto. WebGL cru (poucos KB), 7.000 pontos com brilho aditivo; todo o movimento
 * é calculado na GPU a partir de 3 posições por grão e do progresso da rolagem. Roda só com a seção na tela, desiste
 * sozinho em máquina lenta (fica a versão parada) e nada re-renderiza o React por quadro.
 */
const N = 7000;

const VS = `
attribute vec2 aA; attribute vec2 aB; attribute vec2 aC; attribute vec4 aR; attribute float aH;
uniform vec2 uRes; uniform float uAB; uniform float uBC; uniform float uT; uniform float uTam;
uniform mediump float uHalo; // mesma precisão do fragment shader (senão o programa não liga no WebGL 1)
varying float vCor; varying float vBrilho; varying float vQuente;
float suave(float x){ x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
void main(){
  float t1 = suave(uAB * 1.5 - aR.x * 0.5);
  float t2 = suave(uBC * 1.5 - aR.y * 0.5);
  vec2 p = mix(mix(aA, aB, t1), aC, t2);
  float voo = t1 * (1.0 - t1) * 4.0 + t2 * (1.0 - t2) * 4.0;
  float ang = aR.z * 6.2831 + uT * (0.35 + aR.w * 0.5);
  float solto = 1.0 - t1;
  p += vec2(cos(ang), sin(ang * 1.3)) * (voo * 70.0 + 1.6 + solto * 14.0);
  vec2 c = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  gl_PointSize = uTam * (0.55 + aR.w * 0.9) * (1.0 + uHalo * 3.2) * (1.0 + t2 * 0.25);
  vCor = aR.w;
  vBrilho = 0.7 + 0.3 * sin(uT * 2.2 + aR.z * 40.0);
  vQuente = aH * t1 * (1.0 - t2) * (0.6 + 0.4 * sin(uT * 3.0 + aR.x * 20.0)) + t2 * 0.75;
}`;

const FS = `
precision mediump float;
uniform float uHalo;
varying float vCor; varying float vBrilho; varying float vQuente;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c);
  if (r > 0.25) discard;
  float a = uHalo > 0.5 ? exp(-r * 18.0) * 0.12 : smoothstep(0.25, 0.0, r);
  vec3 creme = vec3(0.96, 0.93, 0.85);
  vec3 ouro = vec3(0.99, 0.70, 0.26);
  vec3 cor = mix(creme, ouro, clamp(vCor * 0.35 + vQuente * 1.4, 0.0, 1.0)) * (1.0 + vQuente * 0.6);
  a *= vBrilho;
  gl_FragColor = vec4(cor * a, a);
}`;

const suave = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Sorteia `n` pontos dentro do que foi pintado num canvas 2D (mapa ou número), com um tremor de meio pixel. */
function amostrar(
  desenhar: (ctx: CanvasRenderingContext2D) => void,
  w: number,
  h: number,
  n: number,
): Float32Array {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  desenhar(ctx);
  const dados = ctx.getImageData(0, 0, w, h).data;
  const cheios: number[] = [];
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) if (dados[(y * w + x) * 4 + 3]! > 128) cheios.push(x, y);
  const out = new Float32Array(n * 2);
  const total = cheios.length / 2;
  for (let i = 0; i < n; i++) {
    const k = total ? Math.floor(Math.random() * total) : 0;
    out[i * 2] = (cheios[k * 2] ?? w / 2) + Math.random() * 2 - 1;
    out[i * 2 + 1] = (cheios[k * 2 + 1] ?? h / 2) + Math.random() * 2 - 1;
  }
  return out;
}

export default function GraoAoNumero({ progresso }: { progresso: MotionValue<number> }) {
  const palco = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const legendas = useRef<(HTMLDivElement | null)[]>([]);
  const v = useRef(0);
  useMotionValueEvent(progresso, "change", (x) => (v.current = x));
  const exemplos = useExemplosDoDia();
  const praca = exemplos?.comparativoSoja?.find((p) => p.uf === "MT") ?? null;
  // Sem o preço do dia (falha de rede), os grãos formam "Seu preço" e a legenda não cita dado.
  const numero = praca ? `R$ ${brl2(praca.preco)}` : "Seu preço";
  const [semGl, setSemGl] = useState(false);

  useEffect(() => {
    const el = palco.current;
    const canvas = tela.current;
    if (!el || !canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
    const prog = gl && !gl.isContextLost() ? criarPrograma(gl, VS, FS) : null;
    if (!gl || !prog) {
      setSemGl(true);
      return;
    }
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    // Máquina média: metade dos grãos e resolução 1x (o brilho é suave, quase não se nota)
    const media = nivelDaMaquina() === "media";
    const dpr = media ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    let quantas = media ? Math.round(N * 0.5) : N;
    const loc = (n: string) => gl.getAttribLocation(prog, n);
    const uni = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = uni("uRes"),
      uAB = uni("uAB"),
      uBC = uni("uBC"),
      uT = uni("uT"),
      uTam = uni("uTam"),
      uHalo = uni("uHalo");

    // Aleatórios fixos por grão (atraso de cada fase, ângulo do voo, tamanho/cor)
    const rand = new Float32Array(N * 4).map(() => Math.random());
    const buffers = new Map<string, WebGLBuffer>();
    const ligar = (nome: string, dados: Float32Array, tam: number) => {
      let b = buffers.get(nome);
      if (!b) {
        b = gl.createBuffer()!;
        buffers.set(nome, b);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, dados, gl.STATIC_DRAW);
      const l = loc(nome);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, tam, gl.FLOAT, false, 0, 0);
    };
    ligar("aR", rand, 4);

    // Monta as 3 formas no tamanho atual do palco: nuvem, mapa (área da direita) e número.
    const montar = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTam, 3.1 * dpr);
      const reg = { x: w * 0.47, y: h * 0.14, w: w * 0.49, h: h * 0.76 };
      const nuvem = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) {
        nuvem[i * 2] = w * (0.04 + Math.random() * 0.94);
        nuvem[i * 2 + 1] = h * (0.03 + Math.random() * 0.94);
      }
      const escala = Math.min(reg.w / MAPA_BRASIL.largura, reg.h / MAPA_BRASIL.altura);
      const ox = reg.x + (reg.w - MAPA_BRASIL.largura * escala) / 2;
      const oy = reg.y + (reg.h - MAPA_BRASIL.altura * escala) / 2;
      const mapa = amostrar(
        (ctx) => {
          ctx.setTransform(escala, 0, 0, escala, ox, oy);
          ctx.fill(new Path2D(MAPA_BRASIL.pais));
        },
        Math.ceil(w),
        Math.ceil(h),
        N,
      );
      // Brilho das sedes das fontes (Conab no DF, Imea no MT, BBM/B3/IEA em SP...)
      const quente = new Float32Array(N);
      const sedes = Object.values(SEDES).map(
        ([sx, sy]) => [ox + sx * escala, oy + sy * escala] as const,
      );
      const raio = 30 * escala * 2.2;
      for (let i = 0; i < N; i++) {
        let q = 0;
        for (const [sx, sy] of sedes) {
          const dx = mapa[i * 2]! - sx,
            dy = mapa[i * 2 + 1]! - sy;
          q = Math.max(q, Math.exp(-(dx * dx + dy * dy) / (2 * raio * raio)));
        }
        quente[i] = q;
      }
      const texto = amostrar(
        (ctx) => {
          let tam = reg.h * 0.34;
          ctx.font = `800 ${tam}px "Bricolage Grotesque", sans-serif`;
          const largura = ctx.measureText(numero).width;
          if (largura > reg.w) {
            tam *= reg.w / largura;
            ctx.font = `800 ${tam}px "Bricolage Grotesque", sans-serif`;
          }
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#fff";
          ctx.fillText(numero, reg.x + reg.w / 2, reg.y + reg.h / 2);
        },
        Math.ceil(w),
        Math.ceil(h),
        N,
      );
      ligar("aA", nuvem, 2);
      ligar("aB", mapa, 2);
      ligar("aC", texto, 2);
      ligar("aH", quente, 1);
    };
    let pronto = false;
    void document.fonts.ready.then(() => {
      montar();
      pronto = true;
    });
    const ro = new ResizeObserver(() => pronto && montar());
    ro.observe(el);

    let ab = 0,
      bc = 0,
      raf = 0,
      visivel = false,
      ultimo = 0,
      janelaIni = 0,
      janelaQuadros = 0,
      lentas = 0;
    const io = new IntersectionObserver(([e]) => {
      visivel = !!e?.isIntersecting;
      if (visivel && !raf) raf = requestAnimationFrame(quadro);
    });
    io.observe(el);

    function quadro(agora: number) {
      raf = 0;
      if (!visivel || document.hidden || !gl) return;
      raf = requestAnimationFrame(quadro);
      const dt = ultimo ? agora - ultimo : 16;
      ultimo = agora;
      // Máquina que não segura ~20 quadros por segundo em duas janelas seguidas de 2 s: para e mostra a versão parada.
      // Pausas isoladas (aba trocada, travada longa) não contam.
      if (dt < 250) {
        if (!janelaIni) janelaIni = agora;
        janelaQuadros++;
        if (agora - janelaIni > 2000) {
          const fps = (janelaQuadros * 1000) / (agora - janelaIni);
          lentas = fps < 20 ? lentas + 1 : 0;
          janelaIni = agora;
          janelaQuadros = 0;
          // Primeira janela lenta: menos grãos. Duas seguidas já com menos grãos: versão parada.
          if (lentas >= 1 && quantas > N * 0.3) {
            quantas = Math.round(quantas * 0.5);
            lentas = 0;
          } else if (lentas >= 2) {
            cancelAnimationFrame(raf);
            raf = 0;
            setSemGl(true);
            return;
          }
        }
      }
      const p = v.current;
      ab += (suave((p - 0.08) / 0.32) - ab) * 0.12;
      bc += (suave((p - 0.5) / 0.3) - bc) * 0.12;
      // Legendas: uma por fase, trocando com fade
      const alvos = [
        1 - suave((p - 0.18) / 0.08),
        suave((p - 0.28) / 0.08) * (1 - suave((p - 0.52) / 0.08)),
        suave((p - 0.64) / 0.08),
      ];
      legendas.current.forEach((l, i) => {
        if (!l) return;
        l.style.opacity = String(alvos[i]);
        l.style.transform = `translateY(${(1 - alvos[i]!) * 18}px)`;
      });
      if (!pronto) return;
      gl.uniform1f(uAB, ab);
      gl.uniform1f(uBC, bc);
      gl.uniform1f(uT, agora / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // primeiro o halo (pontos grandes e fracos = brilho difuso), depois os grãos
      gl.uniform1f(uHalo, 1);
      gl.drawArrays(gl.POINTS, 0, quantas);
      gl.uniform1f(uHalo, 0);
      gl.drawArrays(gl.POINTS, 0, quantas);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteProgram(prog);
      // Não perde o contexto aqui: o efeito roda de novo quando o preço do dia chega (o número muda) e o canvas
      // devolveria o mesmo contexto já perdido. Ao desmontar, o canvas sai da página e o navegador libera tudo.
    };
  }, [numero]);

  const textos = [
    {
      titulo: "Todo dia, milhares de números.",
      texto:
        "Conab, órgãos estaduais, bolsas e institutos publicam preços o tempo todo, espalhados pelo país.",
    },
    {
      titulo: "A gente junta o Brasil inteiro.",
      texto: "Cada fonte no seu estado, cruzada com as outras quando cobrem a mesma cultura.",
    },
    {
      titulo: "E entrega um número certo.",
      texto: praca
        ? `O da sua praça, com fonte e data. Soja em ${praca.praca}/MT, BBM, ${diaMes(praca.data)}.`
        : "O da sua praça, com fonte e data.",
    },
  ];

  return (
    <div ref={palco} className="sticky top-0 h-screen overflow-hidden">
      {!semGl && <canvas ref={tela} className="absolute inset-0 h-full w-full" />}
      {semGl && (
        <p className="absolute top-1/2 right-[5%] w-[53%] -translate-y-1/2 text-center font-display text-[clamp(4rem,9vw,9rem)] leading-none font-extrabold tracking-tight text-[oklch(0.86_0.13_80)]">
          {numero}
        </p>
      )}
      {/* sombra atrás da legenda: os grãos soltos passam por ali e não podem atrapalhar a leitura */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[52%] bg-gradient-to-r from-primary via-primary/85 to-transparent" />
      <div className="absolute top-1/2 left-10 w-[min(30rem,34vw)] -translate-y-1/2 xl:left-[11.5rem]">
        {textos.map((t, i) => (
          <div
            key={t.titulo}
            ref={(el) => {
              legendas.current[i] = el;
            }}
            className={i === 0 ? "" : "absolute inset-x-0 top-0"}
            style={{ opacity: semGl ? (i === 2 ? 1 : 0) : i === 0 ? 1 : 0 }}
          >
            <p className="text-sm font-semibold tracking-[0.2em] text-[oklch(0.86_0.13_80)] uppercase">
              {String(i + 1).padStart(2, "0")} · Do grão ao número
            </p>
            <h3 className="mt-4 font-display text-5xl leading-[1.02] font-extrabold tracking-tight text-balance xl:text-6xl">
              {t.titulo}
            </h3>
            <p className="mt-5 text-lg leading-relaxed text-primary-foreground/80">{t.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
