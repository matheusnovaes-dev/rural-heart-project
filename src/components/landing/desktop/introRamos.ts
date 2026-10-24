import { criarPrograma } from "./gl";
import { nivelDaMaquina } from "./qualidade";

/**
 * Abertura 3D do desktop (nível Active Theory): ramos de luz dourada NASCEM da base da tela, crescem em profundidade (os de trás
 * menores, mais lentos e apagados), soltam folhas e convergem para o centro, onde a assinatura "Safralume" se escreve no fim
 * (a assinatura e o texto continuam em SVG/CSS, em IntroAssinatura.tsx; aqui é só o mundo em volta). Pólen em profundidade flutua
 * o tempo todo e cada ramo principal, ao chegar, solta uma pequena explosão de pólen. A câmera avança devagar e o mouse dá paralaxe.
 *
 * WebGL cru (sem three.js, poucos KB), mistura aditiva (brilho sem pós-processamento): cada ramo é uma fita com núcleo fino e halo
 * largo; o crescimento é calculado na GPU a partir do tempo de nascimento de cada vértice. Gerado com semente fixa (mesmo desenho
 * sempre). Resolução se adapta se a máquina não aguentar.
 *
 * Linha do tempo (a mesma do CSS em styles.css, bloco `intro-3d`, ~3s): ramos 0 a ~1,2s; assinatura 0,75 a 1,95s; de 2,2 a
 * 3,0s a cena esquenta e se dissolve na foto do hero enquanto a assinatura voa até o logo do topo. Quem chama é IntroAssinatura (só desktop, 1ª visita, máquina que não seja "baixa").
 */

const FIM_MS = 3000;

// ------------------------------------------------------------------ geração dos ramos
type Pt = { x: number; y: number; t: number; w: number };
type Ramo = { pts: Pt[]; z: number; principal: boolean };
type Folha = { x: number; y: number; z: number; ang: number; tam: number; t: number; tipo: number }; // tipo 0 folha, 1 espiga
type Rajada = { x: number; y: number; z: number; t: number };

function rng(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gerar(W: number, H: number, nivel: "alta" | "media") {
  const r = rng(2310);
  const ramos: Ramo[] = [];
  const folhas: Folha[] = [];
  const rajadas: Rajada[] = [];
  const larguraAss = Math.min(704, W * 0.66);
  const cy = H * 0.5;
  const N = nivel === "alta" ? 9 : 7;
  const PASSO = 7;

  // ramo que cresce de `ini` em direção a `alvo` (se houver), com ondulação orgânica; devolve os pontos
  function crescer(o: {
    x: number;
    y: number;
    ang: number;
    alvo?: { x: number; y: number };
    comp: number;
    t0: number;
    vel: number;
    w0: number;
    curva: number;
    fase: number;
  }): Pt[] {
    const pts: Pt[] = [{ x: o.x, y: o.y, t: o.t0, w: o.w0 }];
    let { x, y, ang } = o;
    let andado = 0;
    const passos = Math.ceil(o.comp / PASSO);
    for (let i = 1; i <= passos; i++) {
      if (o.alvo) {
        const desejado = Math.atan2(o.alvo.y - y, o.alvo.x - x);
        let d = desejado - ang;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        // vai virando para o alvo, mais forte perto do fim (chega certinho)
        ang += d * (0.035 + 0.12 * (i / passos) ** 2);
      } else {
        ang += o.curva;
      }
      ang += Math.sin(i * 0.31 + o.fase) * 0.035; // ondulação de planta
      x += Math.cos(ang) * PASSO;
      y += Math.sin(ang) * PASSO;
      andado += PASSO;
      const prog = i / passos;
      pts.push({ x, y, t: o.t0 + andado / o.vel, w: o.w0 * (1 - prog * 0.72) });
      if (o.alvo && Math.hypot(o.alvo.x - x, o.alvo.y - y) < PASSO * 1.5) break;
    }
    return pts;
  }

  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const z = r() * 0.85; // 0 perto, ~0.85 longe
    const lateral = false;
    const x0 = lateral ? (i === 0 ? -20 : W + 20) : W * (0.1 + 0.8 * u) + (r() - 0.5) * 50;
    const y0 = lateral ? H * (0.62 + r() * 0.2) : H + 24;
    // alvo: um ponto da linha da assinatura (centro da tela)
    const ux = (u - 0.5) * 0.92 + (r() - 0.5) * 0.08;
    const alvo = { x: W / 2 + ux * larguraAss, y: cy + H * 0.05 + (r() - 0.5) * 24 };
    const dist = Math.hypot(alvo.x - x0, alvo.y - y0);
    const t0 = 0.0 + r() * 0.12;
    const tFim = 0.95 + r() * 0.25;
    const vel = (dist * 1.25) / (tFim - t0);
    const angIni = lateral ? (i === 0 ? -0.35 : Math.PI + 0.35) : -Math.PI / 2 + (r() - 0.5) * 0.5;
    const pts = crescer({
      x: x0,
      y: y0,
      ang: angIni,
      alvo,
      comp: dist * 1.6,
      t0,
      vel,
      w0: 6.2 - z * 2.6,
      curva: 0,
      fase: r() * 6.28,
    });
    ramos.push({ pts, z, principal: true });
    const ult = pts[pts.length - 1]!;
    rajadas.push({ x: ult.x, y: ult.y, z, t: ult.t });
    // ao chegar, a ponta do ramo principal vira uma espiga de trigo
    const pen = pts[Math.max(0, pts.length - 4)]!;
    folhas.push({
      x: ult.x,
      y: ult.y,
      z,
      ang: Math.atan2(ult.y - pen.y, ult.x - pen.x),
      tam: 30 + r() * 12,
      t: ult.t - 0.05,
      tipo: 1,
    });

    // galhos laterais
    let proximo = 40 + r() * 50;
    let acumulado = 0;
    for (let k = 1; k < pts.length - 4; k++) {
      acumulado += PASSO;
      if (acumulado < proximo) continue;
      acumulado = 0;
      proximo = 45 + r() * 70;
      if (r() > 0.5) continue;
      const a = pts[k]!;
      const b = pts[k + 1]!;
      const dir = Math.atan2(b.y - a.y, b.x - a.x);
      const lado = r() > 0.5 ? 1 : -1;
      const filho = crescer({
        x: a.x,
        y: a.y,
        ang: dir + lado * (0.5 + r() * 0.45),
        comp: 36 + r() * 120,
        t0: a.t,
        vel: vel * (1.05 + r() * 0.4),
        w0: a.w * 0.6,
        curva: -lado * (0.02 + r() * 0.035),
        fase: r() * 6.28,
      });
      ramos.push({ pts: filho, z, principal: false });
      const fim = filho[filho.length - 1]!;
      folhas.push({
        x: fim.x,
        y: fim.y,
        z,
        ang: dir + lado * 0.9,
        tam: 15 + r() * 12,
        t: fim.t,
        tipo: 0,
      });
      // netos curtos
      if (r() < 0.2 && filho.length > 6) {
        const m = filho[Math.floor(filho.length / 2)]!;
        const n = filho[Math.floor(filho.length / 2) + 1]!;
        const d2 = Math.atan2(n.y - m.y, n.x - m.x);
        const neto = crescer({
          x: m.x,
          y: m.y,
          ang: d2 - lado * (0.6 + r() * 0.3),
          comp: 18 + r() * 46,
          t0: m.t,
          vel: vel * 1.3,
          w0: m.w * 0.6,
          curva: lado * 0.03,
          fase: r() * 6.28,
        });
        ramos.push({ pts: neto, z, principal: false });
        const f2 = neto[neto.length - 1]!;
        folhas.push({
          x: f2.x,
          y: f2.y,
          z,
          ang: d2 - lado * 0.8,
          tam: 11 + r() * 9,
          t: f2.t,
          tipo: 0,
        });
      }
      // folha junto ao nó
      if (r() < 0.5)
        folhas.push({
          x: a.x,
          y: a.y,
          z,
          ang: dir - lado * 1.1,
          tam: 12 + r() * 10,
          t: a.t + 0.05,
          tipo: 0,
        });
    }
  }
  return { ramos, folhas, rajadas };
}

// ------------------------------------------------------------------ shaders
// Projeção comum: profundidade (z) aproxima do centro e encolhe; a câmera avança (uCam); o mouse desloca mais o que está perto.
const PROJ = `
uniform vec2 uRes; uniform float uCam; uniform vec2 uMouse;
vec2 projeta(vec2 p, float z){
  vec2 c = uRes * 0.5;
  float persp = uCam / (1.0 + z * 0.75);
  vec2 s = c + (p - c) * persp + uMouse * (1.0 - z) * 18.0;
  return vec2(s.x / uRes.x * 2.0 - 1.0, 1.0 - s.y / uRes.y * 2.0);
}`;

const VS_RAMO = `
attribute vec2 aPos; attribute vec2 aNrm; attribute float aZ; attribute float aSide; attribute float aT; attribute float aW;
uniform float uTime; uniform float uLarg; uniform float uDpr;
varying float vSide; varying float vVis; varying float vHead; varying float vZ; varying float vPulso; varying float vW;
${PROJ}
void main(){
  float idade = uTime - aT;
  vVis = clamp(idade / 0.05, 0.0, 1.0);
  vHead = idade >= 0.0 ? exp(-idade * 7.0) : 0.0;
  vSide = aSide; vZ = aZ; vW = clamp((aW - 0.4) / 2.5, 0.0, 1.0);
  // seiva/luz que sobe da base às pontas enquanto a assinatura se escreve
  float onda = (uTime - (0.9 + aT * 0.38)) * 5.0;
  vPulso = exp(-onda * onda);
  float persp = uCam / (1.0 + aZ * 0.75);
  vec2 p = aPos + aNrm * aSide * aW * uLarg / max(persp, 0.3);
  gl_Position = vec4(projeta(p, aZ), 0.0, 1.0);
}`;
// Duas passadas: halo (luz suave do amanhecer em volta, aditivo) e o caule em si (sólido, sombreado como um cilindro:
// lado iluminado, lado na sombra e um fio de brilho), da cor de planta: base oliva, pontas douradas.
const FS_RAMO = `
precision mediump float;
uniform float uForca; uniform float uFade; uniform float uHalo;
varying float vSide; varying float vVis; varying float vHead; varying float vZ; varying float vPulso; varying float vW;
void main(){
  float s = vSide;
  if (uHalo > 0.5) {
    float h = exp(-s * s * 1.6) * vVis * uForca * (1.0 - vZ * 0.6) * (0.5 + vPulso * 1.8 + vHead) * uFade;
    gl_FragColor = vec4(vec3(1.0, 0.68, 0.3) * h, h);
    return;
  }
  float tubo = sqrt(max(1.0 - s * s, 0.0));
  float a = smoothstep(1.0, 0.72, abs(s)) * vVis * uFade;
  vec3 oliva = vec3(0.36, 0.40, 0.15);
  vec3 ouro = vec3(0.90, 0.64, 0.27);
  vec3 base = mix(ouro, oliva, vW * 0.7);
  float luz = 0.32 + 0.68 * tubo * (0.72 + 0.28 * s);
  float fio = pow(tubo, 16.0) * 0.4 * (0.5 + 0.5 * s);
  vec3 cor = base * luz + vec3(1.0, 0.9, 0.7) * fio + vec3(1.0, 0.78, 0.4) * (vHead * 0.7 + vPulso * 0.55);
  cor = mix(cor, vec3(0.13, 0.24, 0.18), vZ * 0.5); // atmosfera: o que está longe fica esverdeado e apagado
  a *= 1.0 - vZ * 0.25;
  gl_FragColor = vec4(cor * a, a);
}`;

const VS_FOLHA = `
attribute vec2 aPos; attribute vec2 aCanto; attribute float aZ; attribute float aAng; attribute float aTam; attribute float aT;
attribute float aTipo;
uniform float uTime;
varying vec2 vUv; varying float vVis; varying float vZ; varying float vTipo;
${PROJ}
void main(){
  float idade = uTime - aT;
  float b = clamp(idade / (aTipo > 0.5 ? 0.35 : 0.5), 0.0, 1.0);
  b = 1.0 - pow(1.0 - b, 3.0);
  float s = aTam * b * (1.0 + 0.12 * sin(clamp(idade, 0.0, 1.0) * 6.0) * (1.0 - b));
  float c = cos(aAng), sn = sin(aAng);
  float largura = aTipo > 0.5 ? 0.3 : 0.42;
  vec2 l = vec2(aCanto.x * s, aCanto.y * s * largura);
  vec2 off = vec2(l.x * c - l.y * sn, l.x * sn + l.y * c);
  vUv = aCanto; vVis = clamp(idade / 0.12, 0.0, 1.0); vZ = aZ; vTipo = aTipo;
  gl_Position = vec4(projeta(aPos + off + vec2(c, sn) * s, aZ), 0.0, 1.0);
}`;
// Folha de verdade (lanceolada, com nervura central, nervuras laterais, borda mais escura e um lado na sombra) ou espiga de
// trigo (grãos alternados em fila e barbas finas na ponta).
const FS_FOLHA = `
precision mediump float;
uniform float uFade;
varying vec2 vUv; varying float vVis; varying float vZ; varying float vTipo;
void main(){
  float x = (vUv.x + 1.0) * 0.5;  // 0 na base, 1 na ponta
  float y = vUv.y;                 // -1 a 1 na largura
  float a; vec3 cor;
  if (vTipo > 0.5) {
    float corpo = step(x, 0.78);
    float fila = fract(x * 9.0);
    float lado = mod(floor(x * 9.0), 2.0) * 2.0 - 1.0;
    float grao = smoothstep(1.0, 0.7, length(vec2((fila - 0.5) * 2.2, (y - lado * 0.32) * 1.6))) * corpo * step(0.06, x);
    float barbas = 0.0;
    for (int k = 0; k < 3; k++) {
      float yk = (float(k) - 1.0) * 0.35 * (0.3 + (x - 0.7) * 2.5);
      barbas = max(barbas, smoothstep(0.09, 0.02, abs(y - yk)) * step(0.7, x));
    }
    float haste = smoothstep(0.12, 0.05, abs(y)) * step(x, 0.12);
    a = max(max(grao, barbas * 0.8), haste);
    float sombra = 0.75 + 0.25 * (1.0 - fila) + 0.1 * y;
    cor = mix(vec3(0.78, 0.54, 0.2), vec3(0.98, 0.78, 0.42), grao * (1.0 - fila * 0.5)) * sombra;
  } else {
    float meia = 0.95 * pow(sin(3.14159 * clamp(x, 0.0, 1.0)), 0.75) * (1.0 - x * 0.25);
    a = smoothstep(meia, meia - 0.12, abs(y));
    float nervura = exp(-y * y * 90.0);
    float laterais = smoothstep(0.08, 0.0, abs(fract(x * 5.0 - abs(y) * 1.6) - 0.5) - 0.42) * 0.25;
    vec3 verde = mix(vec3(0.24, 0.40, 0.10), vec3(0.56, 0.62, 0.20), x);
    float sombra = y > 0.0 ? 1.0 : 0.72;
    float borda = smoothstep(meia - 0.05, meia - 0.25, abs(y));
    cor = verde * sombra * (0.7 + 0.3 * borda) + vec3(0.75, 0.8, 0.45) * (nervura * 0.35 + laterais * 0.3);
  }
  cor = mix(cor, vec3(0.13, 0.24, 0.18), vZ * 0.5);
  a *= vVis * uFade * (1.0 - vZ * 0.25);
  gl_FragColor = vec4(cor * a, a);
}`;

const VS_POLEN = `
attribute vec2 aPos; attribute float aZ; attribute float aTam; attribute vec4 aExtra; // extra: semente, nascimento, vx, vy
uniform float uTime; uniform float uDpr;
varying float vA;
${PROJ}
void main(){
  vec2 p = aPos;
  float a;
  if (aExtra.y < 0.0) {
    // pólen ambiente: sobe devagar e balança, dá a volta na tela
    float vel = 14.0 + (1.0 - aZ) * 26.0;
    p.y = mod(aPos.y - uTime * vel, uRes.y + 80.0) - 40.0;
    p.x += sin(uTime * 0.6 + aExtra.x * 6.28) * 14.0;
    a = (0.12 + (1.0 - aZ) * 0.3) * smoothstep(0.0, 0.8, uTime);
  } else {
    // rajada: sai do ponto onde o ramo chegou, abre e some
    float idade = uTime - aExtra.y;
    if (idade < 0.0) { gl_Position = vec4(2.0); gl_PointSize = 0.0; vA = 0.0; return; }
    p += vec2(aExtra.z, aExtra.w) * (1.0 - exp(-idade * 2.2)) * 60.0 + vec2(0.0, -idade * 18.0);
    a = exp(-idade * 1.8) * 0.6;
  }
  float persp = uCam / (1.0 + aZ * 0.75);
  vA = a;
  gl_Position = vec4(projeta(p, aZ), 0.0, 1.0);
  gl_PointSize = aTam * persp * uDpr;
}`;
const FS_POLEN = `
precision mediump float;
uniform float uFade;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float k = exp(-d * d * 3.2) * vA * uFade;
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * k, k);
}`;

// ------------------------------------------------------------------ montagem dos buffers
function fitas(ramos: Ramo[]) {
  const v: number[] = []; // aPos(2) aNrm(2) aZ aSide aT aW = 8 floats
  for (const r of ramos) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i]!;
      const b = r.pts[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l;
      const ny = dx / l;
      const A = (s: number) => [a.x, a.y, nx, ny, r.z, s, a.t, a.w];
      const B = (s: number) => [b.x, b.y, nx, ny, r.z, s, b.t, b.w];
      v.push(...A(-1), ...A(1), ...B(-1), ...A(1), ...B(1), ...B(-1));
    }
  }
  return new Float32Array(v);
}

function quadFolhas(folhas: Folha[]) {
  const v: number[] = []; // aPos(2) aCanto(2) aZ aAng aTam aT aTipo = 9
  const cantos = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const f of folhas)
    for (const [cx, cy] of cantos) v.push(f.x, f.y, cx!, cy!, f.z, f.ang, f.tam, f.t, f.tipo);
  return new Float32Array(v);
}

function polen(W: number, H: number, nivel: "alta" | "media", rajadas: Rajada[]) {
  const r = rng(77);
  const v: number[] = []; // aPos(2) aZ aTam aExtra(4) = 8
  const n = nivel === "alta" ? 60 : 40;
  for (let i = 0; i < n; i++) {
    const z = r();
    v.push(r() * W, r() * (H + 80), z, 2 + (1 - z) * (1 - z) * 9, r(), -1, 0, 0);
  }
  for (const j of rajadas) {
    for (let k = 0; k < 6; k++) {
      const ang = (k / 14) * Math.PI * 2 + r() * 0.4;
      const f = 0.4 + r() * 0.8;
      v.push(j.x, j.y, j.z, 3 + r() * 7, r(), j.t, Math.cos(ang) * f, Math.sin(ang) * f - 0.3);
    }
  }
  return { dados: new Float32Array(v), qtd: v.length / 8 };
}

// ------------------------------------------------------------------ execução
/**
 * Começa a abertura 3D dentro da cobertura. Devolve false se não deu (sem WebGL, shader falhou): quem chama cai na abertura CSS.
 * `aoComecar` é chamado no 1º quadro desenhado (é quando o CSS da assinatura passa a correr, em sincronia).
 */
export function iniciarIntroRamos(
  cobertura: HTMLElement,
  aoComecar: () => void,
  aoAcabar: () => void,
  forcar = false,
): boolean {
  const nivelMaq = nivelDaMaquina();
  if (nivelMaq === "baixa" && !forcar) return false;
  const nivel = nivelMaq === "baixa" ? "media" : nivelMaq;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "intro-canvas";
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  if (!gl) return false;
  const pRamo = criarPrograma(gl, VS_RAMO, FS_RAMO);
  const pFolha = criarPrograma(gl, VS_FOLHA, FS_FOLHA);
  const pPolen = criarPrograma(gl, VS_POLEN, FS_POLEN);
  if (!pRamo || !pFolha || !pPolen) return false;

  const W = window.innerWidth;
  const H = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, nivel === "alta" ? 2 : 1.25);
  const ajustarTamanho = () => {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  ajustarTamanho();
  // Fora da árvore do React (no fim do <body>): o 3D começa ANTES da hidratação e um nó novo dentro da cobertura faria o React
  // acusar divergência e refazer a página. Por cima da cobertura (z-index 201), sem capturar o mouse; some junto com a cortina (CSS).
  void cobertura;
  document.body.appendChild(canvas);

  const { ramos, folhas, rajadas } = gerar(W, H, nivel);
  const bufRamo = gl.createBuffer();
  const dadosRamo = fitas(ramos);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufRamo);
  gl.bufferData(gl.ARRAY_BUFFER, dadosRamo, gl.STATIC_DRAW);
  const bufFolha = gl.createBuffer();
  const dadosFolha = quadFolhas(folhas);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufFolha);
  gl.bufferData(gl.ARRAY_BUFFER, dadosFolha, gl.STATIC_DRAW);
  const bufPolen = gl.createBuffer();
  const pol = polen(W, H, nivel, rajadas);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufPolen);
  gl.bufferData(gl.ARRAY_BUFFER, pol.dados, gl.STATIC_DRAW);

  const ligar = (prog: WebGLProgram, buf: WebGLBuffer | null, attrs: [string, number][]) => {
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const stride = attrs.reduce((s, [, n]) => s + n, 0) * 4;
    let off = 0;
    const usados: number[] = [];
    for (const [nome, n] of attrs) {
      const loc = gl.getAttribLocation(prog, nome);
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off);
        usados.push(loc);
      }
      off += n * 4;
    }
    return () => usados.forEach((l) => gl.disableVertexAttribArray(l));
  };
  const uni = (prog: WebGLProgram) => (nome: string) => gl.getUniformLocation(prog, nome);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // aditivo: brilho sem pós-processamento

  let mouseX = 0;
  let mouseY = 0;
  let alvoX = 0;
  let alvoY = 0;
  const aoMover = (e: PointerEvent) => {
    alvoX = (e.clientX / W - 0.5) * 2;
    alvoY = (e.clientY / H - 0.5) * 2;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  let inicio = 0;
  let raf = 0;
  let parado = false;
  let lentos = 0;
  let ultimo = 0;
  const html = document.documentElement;

  const parar = () => {
    if (parado) return;
    parado = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", aoMover);
    obs.disconnect();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    aoAcabar();
  };
  // A abertura acabou por qualquer motivo (tempo, pulo, segurança do head): some com tudo.
  const obs = new MutationObserver(() => {
    if (!html.classList.contains("intro-ativa")) parar();
  });
  obs.observe(html, { attributes: true, attributeFilter: ["class"] });

  const quadro = (agora: number) => {
    if (parado) return;
    if (!inicio) {
      inicio = agora;
      aoComecar();
    }
    const t = (agora - inicio) / 1000;
    // resolução adaptativa: se os quadros passarem de ~28 ms por um tempo, baixa a resolução uma vez
    if (ultimo && agora - ultimo > 28) lentos++;
    ultimo = agora;
    if (lentos > 12 && dpr > 1) {
      dpr = 1;
      lentos = -1000;
      ajustarTamanho();
    }
    mouseX += (alvoX - mouseX) * 0.06;
    mouseY += (alvoY - mouseY) * 0.06;
    const cam = 1 + 0.07 * (1 - Math.exp(-t * 0.55)); // câmera avançando devagar
    const fade = 1 - Math.min(1, Math.max(0, (t - 2.9) / 0.2));

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const comuns = (u: (n: string) => WebGLUniformLocation | null) => {
      gl.uniform2f(u("uRes"), W, H);
      gl.uniform1f(u("uCam"), cam);
      gl.uniform2f(u("uMouse"), -mouseX, -mouseY);
      gl.uniform1f(u("uTime"), t);
      gl.uniform1f(u("uFade"), fade);
      gl.uniform1f(u("uDpr"), dpr);
    };

    // pólen (atrás)
    gl.blendFunc(gl.ONE, gl.ONE);
    {
      const u = uni(pPolen);
      const solta = ligar(pPolen, bufPolen, [
        ["aPos", 2],
        ["aZ", 1],
        ["aTam", 1],
        ["aExtra", 4],
      ]);
      comuns(u);
      gl.drawArrays(gl.POINTS, 0, pol.qtd);
      solta();
    }
    // ramos: halo largo e fraco + núcleo fino e forte
    {
      const u = uni(pRamo);
      const solta = ligar(pRamo, bufRamo, [
        ["aPos", 2],
        ["aNrm", 2],
        ["aZ", 1],
        ["aSide", 1],
        ["aT", 1],
        ["aW", 1],
      ]);
      comuns(u);
      const n = dadosRamo.length / 8;
      gl.blendFunc(gl.ONE, gl.ONE); // halo: luz somada
      gl.uniform1f(u("uHalo"), 1);
      gl.uniform1f(u("uLarg"), 6.0);
      gl.uniform1f(u("uForca"), 0.09);
      gl.drawArrays(gl.TRIANGLES, 0, n);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // caule sólido por cima
      gl.uniform1f(u("uHalo"), 0);
      gl.uniform1f(u("uLarg"), 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, n);
      solta();
    }
    // folhas
    {
      const u = uni(pFolha);
      const solta = ligar(pFolha, bufFolha, [
        ["aPos", 2],
        ["aCanto", 2],
        ["aZ", 1],
        ["aAng", 1],
        ["aTam", 1],
        ["aT", 1],
        ["aTipo", 1],
      ]);
      comuns(u);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, dadosFolha.length / 9);
      solta();
    }
    if (agora - inicio > FIM_MS + 1500) {
      parar();
      return;
    }
    raf = requestAnimationFrame(quadro);
  };
  raf = requestAnimationFrame(quadro);
  return true;
}

export const DURACAO_INTRO_3D_MS = FIM_MS;
