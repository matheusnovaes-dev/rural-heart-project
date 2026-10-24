import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { nivelDaMaquina } from "./qualidade";

/**
 * Abertura 3D do desktop, "Da semente à lavoura", versão NATURAL (≈2,9s, só 1ª visita, pulável). Nada de brilho de neon: luz de
 * amanhecer de verdade (céu, sol nascendo, contraluz no trigo, névoa de horizonte) e plantas com forma de planta.
 *  0,0 a 0,4s  antes do amanhecer, câmera rente ao chão: um grão de trigo no solo;
 *  0,3 a 1,0s  o grão brota (folhas verdes que se abrem);
 *  0,5 a 2,3s  a câmera sobe e recua; a lavoura nasce em onda a partir da semente, ainda verde;
 *  0,9 a 2,3s  o sol nasce no horizonte e a lavoura AMADURECE (verde -> dourado), com contraluz nas espigas e barbas;
 *  1,3 a 2,1s  a assinatura se escreve no céu (SVG/CSS de IntroAssinatura); 2,2 a 2,75s funde na foto real do hero.
 * Three.js: hastes instanciadas com espiga e barbas desenhadas no shader (recorte suave com MSAA), luz calculada (difusa +
 * translucidez de contraluz), céu procedural com disco do sol, névoa atmosférica, brilho só no sol. Só desktop.
 */

export const DURACAO_LAVOURA_MS = 2850;

function curvaDeAnimacao(t: number, a: number, b: number) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function rng(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ céu (domo procedural com o sol)
const VS_CEU = `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS_CEU = `
uniform vec3 uSolDir; uniform float uAmanhecer;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 d = normalize(vDir);
  float alt = clamp(d.y, -0.2, 1.0);
  // madrugada (azul-petróleo escuro) -> amanhecer (azul claro no alto, pêssego/laranja no horizonte)
  vec3 zenite = mix(vec3(0.010, 0.018, 0.030), vec3(0.10, 0.17, 0.30), uAmanhecer);
  vec3 horiz = mix(vec3(0.030, 0.030, 0.040), vec3(0.85, 0.42, 0.18), uAmanhecer);
  vec3 cor = mix(horiz, zenite, pow(smoothstep(0.0, 0.55, alt), 0.6));
  float mu = max(dot(d, uSolDir), 0.0);
  // brilho em volta do sol (espalhamento) e disco
  cor += vec3(1.0, 0.55, 0.22) * pow(mu, 9.0) * 0.55 * uAmanhecer;
  cor += vec3(1.0, 0.72, 0.40) * pow(mu, 60.0) * 1.2 * uAmanhecer;
  cor += vec3(4.0, 3.0, 2.0) * smoothstep(0.99955, 0.99975, mu) * uAmanhecer;
  // nuvens baixas e finas, iluminadas por baixo
  vec2 uv = d.xz / max(d.y + 0.08, 0.04);
  float n = ruido(uv * 1.4) * 0.6 + ruido(uv * 3.1) * 0.4;
  float nuvem = smoothstep(0.55, 0.85, n) * smoothstep(0.02, 0.10, alt) * (1.0 - smoothstep(0.18, 0.35, alt));
  cor = mix(cor, mix(vec3(0.05,0.05,0.07), vec3(1.0, 0.55, 0.30), uAmanhecer) * (0.6 + 0.6 * pow(mu, 4.0)), nuvem * 0.55);
  // abaixo do horizonte: chão sem fim escurecendo
  cor = mix(cor, horiz * 0.35, smoothstep(0.0, -0.04, d.y));
  gl_FragColor = vec4(cor, 1.0);
}`;

// ------------------------------------------------------------------ trigo e brotos (mesmo shader)
// aInst: x, z, altura, fase | aTipo: 0 trigo, 1 broto (folha) | aGiro: rotação em torno do eixo vertical
const VS_PLANTA = `
attribute vec4 aInst; attribute float aNasce; attribute float aTipo; attribute float aGiro;
uniform float uTime; uniform vec2 uVento; uniform vec3 uMouseMundo;
varying vec2 vUv; varying float vIdade; varying vec3 vN; varying vec3 vPos; varying float vTom; varying float vTipo;
void main(){
  float cresce = clamp((uTime - aNasce) / (aTipo > 0.5 ? 0.55 : 0.65), 0.0, 1.0);
  cresce = 1.0 - pow(1.0 - cresce, 3.0);
  vec3 p = position;
  float y = uv.y;
  float h = aInst.z * cresce;
  p.y *= h;
  p.x *= mix(0.35, 1.0, cresce);
  // vento: onda que corre pela lavoura + rajada perto do mouse; cada haste tem sua inclinação natural
  float onda = sin(uTime * 1.4 + aInst.w + aInst.x * 0.35 + aInst.y * 0.22) * 0.06;
  float perto = exp(-pow(distance(vec2(aInst.x, aInst.y), uMouseMundo.xz) / 3.0, 2.0));
  float inclina = sin(aInst.w * 3.7) * 0.16 + cos(aInst.w * 1.3) * 0.06;
  // folha do broto se abre para fora, em arco
  float arco = aTipo > 0.5 ? (0.55 + 0.25 * sin(aInst.w * 5.0)) : 0.0;
  float dobra = (onda + inclina + arco + uVento.x * 0.1 + perto * 0.28 * uVento.y) * y * y * max(h, 0.0001);
  float c = cos(aGiro), s = sin(aGiro);
  vec3 r = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
  r.x += dobra * c; r.z += dobra * s;
  r.y -= abs(dobra) * 0.35 * y; // ao dobrar, a ponta desce um pouco
  vec4 mundo = vec4(r + vec3(aInst.x, 0.0, aInst.y), 1.0);
  vN = vec3(-s, 0.25, c);
  vPos = mundo.xyz; vUv = uv; vIdade = uTime - aNasce; vTom = fract(aInst.w * 7.13); vTipo = aTipo;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}`;
const FS_PLANTA = `
uniform vec3 uSolDir; uniform vec3 uSolCor; uniform vec3 uCeuCor; uniform vec3 uNevoaCor; uniform vec3 uCamPos;
uniform float uNevoa; uniform float uMaduro;
varying vec2 vUv; varying float vIdade; varying vec3 vN; varying vec3 vPos; varying float vTom; varying float vTipo;
void main(){
  float y = vUv.y;
  float x = vUv.x - 0.5;
  float a;
  if (vTipo > 0.5) {
    // folha lanceolada do broto
    float larg = 0.46 * sin(3.14159 * clamp(y, 0.0, 1.0)) * (1.0 - y * 0.35);
    a = smoothstep(larg, larg - 0.06, abs(x));
  } else {
    // haste fina até 62%; espiga de 60% a 86% com grãos alternados; barbas finas de 84% a 100%
    float haste = smoothstep(0.075, 0.045, abs(x)) * step(y, 0.66);
    float e = clamp((y - 0.60) / 0.26, 0.0, 1.0);
    float perfil = 0.30 * sin(3.14159 * e) * (0.82 + 0.18 * abs(sin(e * 34.0)));
    float lado = sign(sin(e * 34.0 + 1.57));
    float grao = smoothstep(perfil, perfil - 0.07, abs(x - lado * 0.04)) * step(0.60, y) * step(y, 0.86);
    float barbas = 0.0;
    for (int k = 0; k < 4; k++) {
      float fk = float(k) - 1.5;
      float xk = fk * 0.07 * (0.4 + (y - 0.82) * 4.0);
      barbas = max(barbas, smoothstep(0.022, 0.006, abs(x - xk)) * step(0.82, y) * (1.0 - smoothstep(0.93, 1.0, y)));
    }
    a = max(max(haste, grao), barbas);
  }
  if (a < 0.35) discard;

  // cor: jovem (verde) -> madura (dourada), com variação entre hastes; base mais escura (sombra da própria lavoura)
  float maduro = (vTipo > 0.5) ? 0.0 : uMaduro * (0.75 + 0.25 * vTom);
  vec3 verde = mix(vec3(0.10, 0.22, 0.05), vec3(0.16, 0.30, 0.07), vTom);
  vec3 ouro = mix(vec3(0.62, 0.42, 0.15), vec3(0.78, 0.56, 0.22), vTom);
  vec3 base = mix(verde, ouro, maduro);
  if (vTipo < 0.5 && y > 0.6) base *= 1.12; // espiga um pouco mais clara
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(uCamPos - vPos);
  float nl = dot(n, uSolDir);
  float difusa = max(nl, 0.0) * 0.75 + abs(nl) * 0.25;
  // translucidez: quando a câmera olha contra o sol, a luz atravessa folhas, espigas e barbas
  float contra = pow(max(dot(V, -uSolDir), 0.0), 5.0);
  float fino = vTipo > 0.5 ? 0.6 : (y > 0.82 ? 1.4 : (y > 0.6 ? 1.0 : 0.55));
  float oclusao = mix(0.28, 1.0, smoothstep(0.0, 0.7, y));
  vec3 cor = base * (uCeuCor * 0.55 + uSolCor * difusa) * oclusao + base * uSolCor * contra * fino * 0.95;
  float d = length(vPos - uCamPos);
  cor = mix(cor, uNevoaCor, 1.0 - exp(-d * uNevoa));
  gl_FragColor = vec4(cor, a);
}`;

// ------------------------------------------------------------------ poeira no ar, iluminada pelo sol
const VS_POEIRA = `
attribute float aFase;
uniform float uTime; uniform float uPx;
varying float vA;
void main(){
  vec3 p = position;
  p.y += sin(uTime * 0.5 + aFase * 6.28) * 0.08 + uTime * 0.03;
  p.x += sin(uTime * 0.35 + aFase * 9.0) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * (0.5 + aFase) * 6.0 / max(-mv.z, 0.1);
  vA = 0.35 + aFase * 0.4;
  gl_Position = projectionMatrix * mv;
}`;
const FS_POEIRA = `
uniform vec3 uSolCor; uniform float uLuz;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float k = exp(-d * d * 4.0) * vA * uLuz;
  gl_FragColor = vec4(uSolCor * 0.6 * k, k);
}`;

// ------------------------------------------------------------------ acabamento (granulado + vinheta)
const ACABAMENTO = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uTime;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 d = vUv - 0.5;
  float vinheta = smoothstep(0.9, 0.3, length(d * vec2(1.05, 1.0)));
  float grao = (hash(vUv * vec2(1280.0, 800.0) + fract(uTime * 7.0) * 100.0) - 0.5) * 0.035;
  gl_FragColor = vec4(c.rgb * (0.68 + 0.32 * vinheta) + grao, 1.0);
}`,
};

// Saneia antes do brilho: um único pixel NaN/infinito (o Safari gera alguns) vira, no desfoque do bloom, a tela inteira preta.
const SANEAR = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
uniform sampler2D tDiffuse; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  bvec4 ruim = bvec4(c.r != c.r || c.r > 1e4, c.g != c.g || c.g > 1e4, c.b != c.b || c.b > 1e4, c.a != c.a);
  if (any(ruim)) c = vec4(0.0, 0.0, 0.0, 1.0);
  gl_FragColor = vec4(min(c.rgb, vec3(16.0)), c.a);
}`,
};

/** Lâmina com duas faces cruzadas (dá volume à planta vista de qualquer lado); uv.y vai de 0 (base) a 1 (ponta). */
function laminaCruzada(largura: number, segmentos: number) {
  const a = new THREE.PlaneGeometry(largura, 1, 1, segmentos);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const pos = new Float32Array([
    ...(a.attributes["position"]!.array as Float32Array),
    ...(b.attributes["position"]!.array as Float32Array),
  ]);
  const uv = new Float32Array([
    ...(a.attributes["uv"]!.array as Float32Array),
    ...(b.attributes["uv"]!.array as Float32Array),
  ]);
  const n = a.attributes["position"]!.count;
  const ia = Array.from(a.index!.array as ArrayLike<number>);
  const idx = [...ia, ...ia.map((i) => i + n)];
  return { pos, uv, idx };
}

/**
 * Começa a abertura. Devolve false se não deu (sem WebGL, máquina "baixa"): quem chama cai na abertura CSS.
 * `aoComecar` roda no 1º quadro desenhado (a partir dele o CSS da assinatura corre em sincronia).
 */
export function iniciarIntroLavoura(aoComecar: () => void, forcar = false): boolean {
  const nivelMaq = nivelDaMaquina();
  if (nivelMaq === "baixa" && !forcar) return false;
  const alta = nivelMaq === "alta";

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      // só para os testes automáticos conseguirem ler o canvas (?intro=3d-teste)
      preserveDrawingBuffer: /[?&]intro=3d-teste/.test(location.search),
    });
  } catch {
    return false;
  }
  const W = window.innerWidth;
  const H = window.innerHeight;
  let px = Math.min(window.devicePixelRatio || 1, alta ? 1.75 : 1);
  renderer.setPixelRatio(px);
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  const canvas = renderer.domElement;
  canvas.className = "intro-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 400);
  const r = rng(2310);

  // céu
  const ceuMat = new THREE.ShaderMaterial({
    vertexShader: VS_CEU,
    fragmentShader: FS_CEU,
    uniforms: {
      uSolDir: { value: new THREE.Vector3(0, -0.1, -1).normalize() },
      uAmanhecer: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), ceuMat);
  cena.add(ceu);

  // solo: terra com torrões e manchas (ruído procedural), luz do sol rasante e a névoa da cena (uniforms ligados mais abaixo)
  const soloMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vPos; void main(){ vec4 m = modelMatrix * vec4(position, 1.0); vPos = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`,
    fragmentShader: `
uniform vec3 uSolDir; uniform vec3 uSolCor; uniform vec3 uCeuCor; uniform vec3 uNevoaCor; uniform vec3 uCamPos; uniform float uNevoa;
uniform vec3 uLuzPonto; uniform float uLuzForca;
varying vec3 vPos;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 q = vPos.xz;
  float n = ruido(q * 1.3) * 0.45 + ruido(q * 7.0) * 0.3 + ruido(q * 31.0) * 0.25;
  vec3 terra = mix(vec3(0.045, 0.030, 0.018), vec3(0.11, 0.075, 0.045), n);
  float torrao = smoothstep(0.62, 0.8, ruido(q * 18.0));
  terra *= 0.85 + torrao * 0.35;
  float dif = max(uSolDir.y, 0.0) * 0.8 + 0.12;
  vec3 cor = terra * (uCeuCor * 0.6 + uSolCor * dif);
  float dp = distance(vPos, uLuzPonto);
  cor += terra * vec3(1.0, 0.8, 0.55) * uLuzForca * 1.3 / (1.0 + dp * dp * 90.0);
  float d = length(vPos - uCamPos);
  cor = mix(cor, uNevoaCor, 1.0 - exp(-d * uNevoa));
  gl_FragColor = vec4(cor, 1.0);
}`,
  });
  const solo = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), soloMat);
  solo.rotation.x = -Math.PI / 2;
  cena.add(solo);
  cena.fog = new THREE.FogExp2(new THREE.Color("#120f10"), 0.03);
  const luzSol = new THREE.DirectionalLight(0xffffff, 0);
  cena.add(luzSol);
  const luzCeu = new THREE.HemisphereLight(0x8aa0c0, 0x1a120a, 0.25);
  cena.add(luzCeu);
  // primeira luz rasante sobre a semente (antes do sol)
  const luzSemente = new THREE.PointLight(0xffd59a, 0.9, 1.2, 1.5);
  luzSemente.position.set(-0.15, 0.22, 0.25);
  cena.add(luzSemente);

  // grão de trigo
  const grao = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 24, 16),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#6e5130"),
      roughness: 0.55,
      metalness: 0.0,
    }),
  );
  grao.scale.set(1, 0.75, 1.9);
  grao.rotation.y = 0.6;
  grao.position.set(0, 0.012, 0);
  cena.add(grao);

  // plantas: trigo (instâncias) + brotos (folhas) no mesmo shader
  const N = alta ? 9000 : 4200;
  const NB = 9; // folhas do broto
  const total = N + NB;
  const { pos, uv, idx } = laminaCruzada(0.07, 12);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const inst = new Float32Array(total * 4);
  const nasce = new Float32Array(total);
  const tipo = new Float32Array(total);
  const giro = new Float32Array(total);
  let i = 0;
  // brotos: folhas que saem do grão
  for (let k = 0; k < NB; k++, i++) {
    inst.set([(r() - 0.5) * 0.02, (r() - 0.5) * 0.02, 0.09 + r() * 0.1, r() * 6.28], i * 4);
    nasce[i] = 0.3 + k * 0.05 + r() * 0.05;
    tipo[i] = 1;
    giro[i] = (k / NB) * Math.PI * 2 + r() * 0.5;
  }
  while (i < total) {
    const frente = i < NB + N * 0.22;
    const z = frente ? 0.3 + r() * 5.8 : -0.2 - Math.pow(r(), 1.3) * 84;
    const largura = frente ? 4 + z * 0.9 : 3 + -z * 1.05;
    const x = (r() - 0.5) * 2 * largura;
    if (z > -0.2 && Math.abs(x) < 0.55) continue; // corredor por onde a câmera passa (vira o carreador, como na foto)
    if (Math.hypot(x, z) < 0.35) continue; // espaço em volta da semente
    const dist = Math.hypot(x, z);
    inst.set([x, z, 0.55 + r() * r() * 0.7 + r() * 0.2, r() * 6.28], i * 4);
    nasce[i] = z > 0.3 ? 1.15 + z * 0.08 + r() * 0.15 : 0.55 + dist / 38 + r() * 0.12;
    tipo[i] = 0;
    giro[i] = r() * Math.PI;
    i++;
  }
  geo.setAttribute("aInst", new THREE.InstancedBufferAttribute(inst, 4));
  geo.setAttribute("aNasce", new THREE.InstancedBufferAttribute(nasce, 1));
  geo.setAttribute("aTipo", new THREE.InstancedBufferAttribute(tipo, 1));
  geo.setAttribute("aGiro", new THREE.InstancedBufferAttribute(giro, 1));
  geo.instanceCount = total;
  const solDir = new THREE.Vector3();
  const corSol = new THREE.Color();
  const corCeu = new THREE.Color();
  const corNevoa = new THREE.Color();
  const plantaMat = new THREE.ShaderMaterial({
    vertexShader: VS_PLANTA,
    fragmentShader: FS_PLANTA,
    side: THREE.DoubleSide,
    transparent: false,
    alphaToCoverage: true,
    uniforms: {
      uTime: { value: 0 },
      uVento: { value: new THREE.Vector2() },
      uMouseMundo: { value: new THREE.Vector3(0, 0, -6) },
      uSolDir: { value: solDir },
      uSolCor: { value: corSol },
      uCeuCor: { value: corCeu },
      uNevoaCor: { value: corNevoa },
      uCamPos: { value: new THREE.Vector3() },
      uNevoa: { value: 0.03 },
      uMaduro: { value: 0 },
    },
  });
  soloMat.uniforms = {
    uSolDir: { value: solDir },
    uSolCor: { value: corSol },
    uCeuCor: { value: corCeu },
    uNevoaCor: { value: corNevoa },
    uCamPos: plantaMat.uniforms["uCamPos"]!,
    uNevoa: { value: 0.03 },
    uLuzPonto: { value: new THREE.Vector3(-0.1, 0.0, 0.18) },
    uLuzForca: { value: 1 },
  };
  const plantas = new THREE.Mesh(geo, plantaMat);
  plantas.frustumCulled = false;
  cena.add(plantas);

  // poeira no ar
  const NP = alta ? 500 : 250;
  const pp = new Float32Array(NP * 3);
  const pf = new Float32Array(NP);
  for (let k = 0; k < NP; k++) {
    pp[k * 3] = (r() - 0.5) * 16;
    pp[k * 3 + 1] = 0.2 + r() * 2.2;
    pp[k * 3 + 2] = -r() * 22 + 3;
    pf[k] = r();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  pg.setAttribute("aFase", new THREE.BufferAttribute(pf, 1));
  const poeiraMat = new THREE.ShaderMaterial({
    vertexShader: VS_POEIRA,
    fragmentShader: FS_POEIRA,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: px },
      uSolCor: { value: corSol },
      uLuz: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const poeira = new THREE.Points(pg, poeiraMat);
  poeira.frustumCulled = false;
  cena.add(poeira);

  // pós-processamento: MSAA no alvo (bordas das folhas), brilho SÓ no que é muito claro (o sol), granulado/vinheta
  const alvo = new THREE.WebGLRenderTarget(W * px, H * px, {
    type: THREE.HalfFloatType,
    samples: alta ? 4 : 2,
  });
  const composer = new EffectComposer(renderer, alvo);
  composer.addPass(new RenderPass(cena, camera));
  composer.addPass(new ShaderPass(SANEAR));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.6, 0.95);
  composer.addPass(bloom);
  const acabamento = new ShaderPass(ACABAMENTO);
  composer.addPass(acabamento);
  composer.addPass(new OutputPass());

  document.body.appendChild(canvas);

  // mouse = vento
  let mx = 0;
  let my = 0;
  let amx = 0;
  let amy = 0;
  const aoMover = (e: PointerEvent) => {
    amx = (e.clientX / W - 0.5) * 2;
    amy = (e.clientY / H - 0.5) * 2;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });
  const raio = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ponto = new THREE.Vector3();
  const mouseNdc = new THREE.Vector2();

  const html = document.documentElement;
  let inicio = 0;
  let raf = 0;
  let parado = false;
  let ultimo = 0;
  let lentos = 0;
  let quadros = 0;
  const modoTeste = /[?&]intro=3d-teste/.test(location.search);

  const parar = () => {
    if (parado) return;
    parado = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", aoMover);
    obs.disconnect();
    canvas.remove();
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  const obs = new MutationObserver(() => {
    if (!html.classList.contains("intro-ativa")) parar();
  });
  obs.observe(html, { attributes: true, attributeFilter: ["class"] });

  // câmera: começa rente ao chão olhando a semente; termina na altura de uma pessoa, com o horizonte a ~27% da tela (foto do hero)
  const ini = new THREE.Vector3(0.07, 0.12, 0.62);
  const fim = new THREE.Vector3(0, 1.45, 8.6);
  const olharIni = new THREE.Vector3(0, 0.025, 0);
  const olharFim = new THREE.Vector3(0, -4.3, -24);
  const olhar = new THREE.Vector3();
  const madrugada = new THREE.Color(0.05, 0.06, 0.09);
  const quente = new THREE.Color(1.0, 0.62, 0.32);
  const ceuDia = new THREE.Color(0.32, 0.38, 0.5);
  const nevoaNoite = new THREE.Color(0.02, 0.022, 0.03);
  const nevoaDia = new THREE.Color(0.62, 0.36, 0.2);

  const quadro = (agora: number) => {
    if (parado) return;
    if (!inicio) {
      inicio = agora;
      aoComecar();
    }
    const t = (agora - inicio) / 1000;
    if (ultimo && agora - ultimo > 30) lentos++;
    ultimo = agora;
    if (lentos > 10) {
      lentos = 0;
      if (px > 0.75) {
        px = Math.max(0.75, px * 0.7);
        renderer.setPixelRatio(px);
        composer.setPixelRatio(px);
      } else {
        bloom.enabled = false;
      }
    }
    quadros++;
    html.dataset["introQuadros"] = String(quadros);
    mx += (amx - mx) * 0.05;
    my += (amy - my) * 0.05;

    // câmera sobe e recua; leve balanço de mão
    const k = curvaDeAnimacao(t, 0.35, 2.3);
    camera.position.lerpVectors(ini, fim, k);
    camera.position.x += mx * 0.22 * k + Math.sin(t * 1.3) * 0.01 * k;
    camera.position.y += -my * 0.08 * k + Math.sin(t * 1.7 + 1) * 0.006 * k;
    olhar.lerpVectors(olharIni, olharFim, k);
    camera.lookAt(olhar);

    // sol nasce: de -5° a +4° de elevação, um pouco à direita
    const am = curvaDeAnimacao(t, 0.55, 2.3);
    const elev = THREE.MathUtils.degToRad(-5 + am * 9);
    solDir
      .set(Math.sin(0.12) * Math.cos(elev), Math.sin(elev), -Math.cos(0.12) * Math.cos(elev))
      .normalize();
    ceuMat.uniforms["uSolDir"]!.value.copy(solDir);
    ceuMat.uniforms["uAmanhecer"]!.value = 0.15 + am * 0.85;
    const luzDoSol = Math.max(0, Math.min(1, (elev + 0.03) / 0.09));
    corSol.copy(quente).multiplyScalar(0.12 + luzDoSol * 1.45);
    corCeu.copy(madrugada).lerp(ceuDia, am);
    corNevoa.copy(nevoaNoite).lerp(nevoaDia, am);
    luzSol.position.copy(solDir).multiplyScalar(50);
    luzSol.color.copy(quente);
    luzSol.intensity = 0.2 + luzDoSol * 2.5;
    luzCeu.intensity = 0.25 + am * 0.6;
    (cena.fog as THREE.FogExp2).color.copy(corNevoa);
    luzSemente.intensity = 0.9 * (1 - curvaDeAnimacao(t, 0.6, 1.4));
    soloMat.uniforms["uLuzForca"]!.value = 1 - curvaDeAnimacao(t, 0.6, 1.4);
    plantaMat.uniforms["uMaduro"]!.value = curvaDeAnimacao(t, 1.0, 2.3);
    plantaMat.uniforms["uCamPos"]!.value.copy(camera.position);
    poeiraMat.uniforms["uLuz"]!.value = am;

    // vento: mouse em coordenadas do chão
    mouseNdc.set(mx, -my);
    raio.setFromCamera(mouseNdc, camera);
    if (raio.ray.intersectPlane(plano, ponto)) plantaMat.uniforms["uMouseMundo"]!.value.copy(ponto);
    (plantaMat.uniforms["uVento"]!.value as THREE.Vector2).set(
      mx,
      Math.min(1, Math.abs(amx - mx) * 6 + 0.3),
    );
    plantaMat.uniforms["uTime"]!.value = t;
    poeiraMat.uniforms["uTime"]!.value = t;
    acabamento.uniforms["uTime"]!.value = t;

    composer.render();
    if (modoTeste && quadros % 6 === 0) {
      // só nos testes (?intro=3d-teste): mede o brilho médio do que foi desenhado, sem depender de print de tela
      const gl = renderer.getContext();
      const px1 = new Uint8Array(4);
      let soma = 0;
      for (let gx = 1; gx < 6; gx++)
        for (let gy = 1; gy < 6; gy++) {
          gl.readPixels(
            Math.floor((gl.drawingBufferWidth * gx) / 6),
            Math.floor((gl.drawingBufferHeight * gy) / 6),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            px1,
          );
          soma += px1[0]! + px1[1]! + px1[2]!;
        }
      html.dataset["introBrilho"] =
        (html.dataset["introBrilho"] ?? "") + `${t.toFixed(1)}:${Math.round(soma / 75)} `;
    }
    if (t * 1000 > DURACAO_LAVOURA_MS + 900) {
      parar();
      return;
    }
    raf = requestAnimationFrame(quadro);
  };
  raf = requestAnimationFrame(quadro);
  return true;
}
