import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { nivelDaMaquina } from "./qualidade";

/**
 * Abertura 3D do desktop, "Da semente à lavoura" (≈2,9s, só 1ª visita, pulável):
 *  0,0 a 0,5s  uma semente dourada brilha no centro (a mesma que o CSS já mostrava desde a 1ª pintura) e se abre num clarão;
 *  0,3 a 1,3s  brotam ramos e raízes de luz em 3D, enquanto a câmera recua e sobe;
 *  0,7 a 2,3s  a lavoura nasce em onda a partir da semente (milhares de hastes que balançam com o vento; o mouse é o vento),
 *              o sol nasce no horizonte e a assinatura se escreve no céu (a assinatura é o SVG/CSS de IntroAssinatura);
 *  2,2 a 2,75s a lavoura de luz se funde na foto real do hero (horizonte alinhado), sem cortina.
 * Three.js com brilho (bloom), névoa, granulado e vinheta. Só desktop: o celular nunca baixa este arquivo.
 */

export const DURACAO_LAVOURA_MS = 2850;

const COR_FUNDO = new THREE.Color("#0a1a12");

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

/** Textura de brilho radial (sol, semente, clarão), feita num canvas 2D, sem baixar imagem. */
function texturaDeBrilho(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.18, "rgba(255,236,190,0.85)");
  gr.addColorStop(0.45, "rgba(255,170,70,0.28)");
  gr.addColorStop(1, "rgba(255,140,40,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ lavoura (hastes instanciadas, vento na GPU)
const VS_HASTE = `
attribute vec4 aInst;   // x, z, altura, fase
attribute float aNasce; // segundo em que a haste começa a nascer (onda que sai da semente)
uniform float uTime; uniform vec2 uVento; uniform vec3 uMouseMundo;
varying float vY; varying float vFrente; varying float vDist;
void main(){
  float cresce = clamp((uTime - aNasce) / 0.55, 0.0, 1.0);
  cresce = 1.0 - pow(1.0 - cresce, 3.0);
  vec3 p = position;
  float y = p.y;                       // 0 na base, 1 na ponta
  p.y *= aInst.z * cresce;
  // vento: onda que corre pela lavoura + rajada que segue o mouse
  float onda = sin(uTime * 1.7 + aInst.w + aInst.x * 0.35 + aInst.y * 0.22) * 0.09;
  float perto = exp(-pow(distance(vec2(aInst.x, aInst.y), uMouseMundo.xz) / 3.0, 2.0));
  float inclina = sin(aInst.w * 3.7) * 0.22 + cos(aInst.w * 1.3) * 0.08;
  float dobra = (onda + inclina + uVento.x * 0.16 + perto * 0.35 * uVento.y) * y * y * aInst.z * cresce;
  p.x += dobra;
  p.z += dobra * 0.3;
  vec4 mundo = vec4(p.x + aInst.x, p.y, p.z + aInst.y, 1.0);
  vY = y;
  vFrente = exp(-max(uTime - aNasce, 0.0) * 1.8) * step(aNasce, uTime) * (aInst.y > 0.0 ? 0.35 : 1.0); // recém-nascida brilha mais
  vec4 mv = modelViewMatrix * mundo;
  vDist = max(-mv.z, 0.0); // atrás da câmera: nunca negativo (pow de negativo vira NaN e o Safari apaga a tela inteira no brilho)
  gl_Position = projectionMatrix * mv;
}`;
const FS_HASTE = `
uniform vec3 uFundo; uniform float uSol; uniform float uBrilho;
varying float vY; varying float vFrente; varying float vDist;
void main(){
  vec3 base = vec3(0.05, 0.035, 0.012);
  vec3 ponta = mix(vec3(0.85, 0.5, 0.16), vec3(1.0, 0.78, 0.42), vFrente);
  vec3 cor = mix(base, ponta, pow(vY, 1.6)) * (1.0 + smoothstep(0.72, 0.85, vY) * 0.6) * (0.32 + vFrente * 1.5 + uSol * 0.28 * vY) * uBrilho;
  float nevoa = 1.0 - exp(-pow(max(vDist, 0.0) / 52.0, 1.5));
  // muito perto da câmera: apaga (não estoura o brilho quando a câmera passa)
  cor *= smoothstep(0.5, 2.6, vDist);
  // ao longe, a lavoura se mistura com a luz do horizonte (sem "muro" no fundo)
  vec3 longe = mix(uFundo, vec3(0.55, 0.27, 0.08), uSol * 0.75);
  gl_FragColor = vec4(mix(cor, longe, nevoa), 1.0);
}`;

// ------------------------------------------------------------------ céu (degradê que esquenta com o nascer do sol)
const VS_CEU = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS_CEU = `
uniform float uSol; uniform vec3 uFundo;
varying vec2 vUv;
void main(){
  float h = vUv.y;
  vec3 alto = uFundo;
  vec3 horizonte = mix(uFundo * 1.4, vec3(0.86, 0.42, 0.12), uSol);
  float k = exp(-pow(max(h - 0.465, 0.0) / 0.055, 1.2));
  vec3 cor = mix(alto, horizonte, k * (0.35 + 0.65 * uSol));
  gl_FragColor = vec4(cor, 1.0);
}`;

// ------------------------------------------------------------------ pólen
const VS_POLEN = `
attribute float aFase;
uniform float uTime; uniform float uPx;
varying float vA;
void main(){
  vec3 p = position;
  p.y += mod(uTime * (0.12 + aFase * 0.18) + aFase * 4.0, 4.0) - 0.6;
  p.x += sin(uTime * 0.7 + aFase * 6.28) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * (0.6 + aFase) * 26.0 / max(-mv.z, 0.1);
  vA = smoothstep(0.0, 0.6, uTime) * (0.4 + aFase * 0.6);
  gl_Position = projectionMatrix * mv;
}`;
const FS_POLEN = `
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float k = exp(-d * d * 3.5) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * k, k);
}`;

// ------------------------------------------------------------------ acabamento (granulado + vinheta)
const ACABAMENTO = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFim: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uTime;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 d = vUv - 0.5;
  float vinheta = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
  float grao = (hash(vUv * vec2(1280.0, 800.0) + fract(uTime * 7.0) * 100.0) - 0.5) * 0.05;
  gl_FragColor = vec4(c.rgb * (0.55 + 0.45 * vinheta) + grao, 1.0);
}`,
};

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
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      // só para os testes automáticos conseguirem fotografar o canvas (?intro=3d-teste)
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
  renderer.setClearColor(COR_FUNDO, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const canvas = renderer.domElement;
  canvas.className = "intro-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const cena = new THREE.Scene();
  cena.background = COR_FUNDO;
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.02, 200);
  const r = rng(2310);
  const brilho = texturaDeBrilho();

  // céu
  const ceuMat = new THREE.ShaderMaterial({
    vertexShader: VS_CEU,
    fragmentShader: FS_CEU,
    uniforms: { uSol: { value: 0 }, uFundo: { value: COR_FUNDO } },
    depthWrite: false,
  });
  const ceu = new THREE.Mesh(new THREE.PlaneGeometry(260, 120), ceuMat);
  ceu.position.set(0, 4, -90);
  cena.add(ceu);

  // sol
  const sol = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: brilho,
      color: new THREE.Color(0.9, 0.6, 0.3),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sol.scale.set(26, 26, 1);
  sol.position.set(4, -16, -80);
  cena.add(sol);

  // chão escuro (some na névoa)
  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#07130d") }),
  );
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = -0.01;
  cena.add(chao);

  // lavoura: hastes instanciadas
  const N = alta ? 9000 : 4200;
  const lamina = new THREE.PlaneGeometry(0.034, 1, 1, 10);
  lamina.translate(0, 0.5, 0);
  const pos = lamina.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // haste fina (25%) e espiga no topo (de 72% a 98% da altura), que fecha numa ponta
    const espiga = y > 0.72 ? Math.sin(((y - 0.72) / 0.28) * Math.PI) : 0;
    pos.setX(i, pos.getX(i) * (0.22 + espiga * 0.9) * (y > 0.97 ? 0.3 : 1));
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = lamina.index;
  geo.attributes["position"] = lamina.attributes["position"]!;
  const inst = new Float32Array(N * 4);
  const nasce = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // mais densa perto do centro do campo de visão final, espalhada até o horizonte
    // 22% das hastes no primeiro plano (entre a semente e a câmera), o resto até o horizonte
    const frente = i < N * 0.22;
    const z = frente ? 0.3 + r() * 5.8 : -0.2 - Math.pow(r(), 1.3) * 84;
    const largura = frente ? 4 + z * 0.9 : 3 + -z * 1.05;
    const x = (r() - 0.5) * 2 * largura;
    if (z > -0.2 && Math.abs(x) < 0.55) {
      i--; // corredor por onde a câmera passa
      continue;
    }
    const dist = Math.hypot(x, z);
    inst[i * 4] = x;
    inst[i * 4 + 1] = z;
    inst[i * 4 + 2] = 0.38 + r() * r() * 1.1 + r() * 0.25;
    inst[i * 4 + 3] = r() * 6.28;
    // a onda sai da semente para longe; o primeiro plano (atrás da semente, onde a câmera passa) nasce por último
    nasce[i] = z > 0.3 ? 1.25 + z * 0.1 + r() * 0.15 : 0.62 + dist / 40 + r() * 0.12;
  }
  geo.setAttribute("aInst", new THREE.InstancedBufferAttribute(inst, 4));
  geo.setAttribute("aNasce", new THREE.InstancedBufferAttribute(nasce, 1));
  geo.instanceCount = N;
  const hasteMat = new THREE.ShaderMaterial({
    vertexShader: VS_HASTE,
    fragmentShader: FS_HASTE,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uVento: { value: new THREE.Vector2() },
      uMouseMundo: { value: new THREE.Vector3(0, 0, -6) },
      uFundo: { value: COR_FUNDO },
      uSol: { value: 0 },
      // mais hastes (máquina forte) = mais luz somada: cada uma brilha um pouco menos
      uBrilho: { value: alta ? 0.62 : 1 },
    },
  });
  const lavoura = new THREE.Mesh(geo, hasteMat);
  lavoura.frustumCulled = false;
  cena.add(lavoura);

  // semente + clarão
  const semente = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 24, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.45) }),
  );
  semente.scale.set(1, 1.25, 1);
  semente.position.set(0, 0.06, 0);
  cena.add(semente);
  const aura = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: brilho,
      color: new THREE.Color(1, 0.75, 0.35),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  aura.position.copy(semente.position);
  (aura.material as THREE.SpriteMaterial).depthTest = false;
  aura.renderOrder = 10;
  cena.add(aura);

  // ramos e raízes de luz (tubos que crescem por drawRange)
  const ramos: { geo: THREE.TubeGeometry; ini: number; fim: number }[] = [];
  const ramoMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.72, 0.28) });
  const NR = alta ? 16 : 11;
  for (let i = 0; i < NR; i++) {
    const ang = (i / NR) * Math.PI * 2 + r() * 0.4;
    const sobe = i % 4 === 0; // alguns brotam para cima, os outros correm rente ao chão como raízes
    const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0.06, 0)];
    let x = 0;
    let y = 0.06;
    let z = 0;
    let a = ang;
    const passos = 7;
    const passo = sobe ? 0.12 : 0.32 + r() * 0.25;
    for (let k = 0; k < passos; k++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a) * passo;
      z += Math.sin(a) * passo * (sobe ? 0.6 : 1) - (sobe ? 0 : 0.05);
      y = sobe ? y + 0.1 + r() * 0.06 : 0.015 + r() * 0.02;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curva, 48, sobe ? 0.006 : 0.004, 5, false);
    g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, ramoMat);
    m.frustumCulled = false;
    cena.add(m);
    const ini = 0.3 + r() * 0.2;
    ramos.push({ geo: g, ini, fim: ini + 0.75 + r() * 0.3 });
  }

  // pólen
  const NP = alta ? 900 : 450;
  const pp = new Float32Array(NP * 3);
  const pf = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    pp[i * 3] = (r() - 0.5) * 30;
    pp[i * 3 + 1] = r() * 3;
    pp[i * 3 + 2] = -r() * 30 + 1;
    pf[i] = r();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  pg.setAttribute("aFase", new THREE.BufferAttribute(pf, 1));
  const polenMat = new THREE.ShaderMaterial({
    vertexShader: VS_POLEN,
    fragmentShader: FS_POLEN,
    uniforms: { uTime: { value: 0 }, uPx: { value: px } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const polen = new THREE.Points(pg, polenMat);
  polen.frustumCulled = false;
  cena.add(polen);

  // pós-processamento: brilho (bloom) + granulado/vinheta
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(cena, camera));
  // Saneia a imagem antes do brilho: um único pixel NaN/infinito (o Safari gera alguns) vira, no desfoque do bloom, a tela
  // inteira preta. Aqui NaN vira 0 e o brilho é limitado.
  composer.addPass(
    new ShaderPass({
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
    }),
  );
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), alta ? 0.6 : 0.7, 0.45, 0.62);
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

  const ini = new THREE.Vector3(0, 0.32, 1.25);
  const fim = new THREE.Vector3(0, 1.45, 8.6);
  const olharIni = new THREE.Vector3(0, 0.08, 0);
  const olharFim = new THREE.Vector3(0, -4.3, -24);
  const olhar = new THREE.Vector3();

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
        bloom.enabled = false; // última economia: sem o brilho espalhado
      }
    }
    quadros++;
    document.documentElement.dataset["introQuadros"] = String(quadros);
    mx += (amx - mx) * 0.05;
    my += (amy - my) * 0.05;

    // câmera: recua e sobe, olhando cada vez mais para o horizonte
    const k = curvaDeAnimacao(t, 0.15, 2.3);
    camera.position.lerpVectors(ini, fim, k);
    camera.position.x += mx * 0.25 * k;
    camera.position.y += -my * 0.1 * k;
    olhar.lerpVectors(olharIni, olharFim, k);
    camera.lookAt(olhar);

    // semente: pulsa, abre num clarão e encolhe
    const clarao = Math.exp(-Math.pow((t - 0.45) / 0.18, 2));
    const s = 0.16 + 0.03 * Math.sin(t * 9) * (t < 0.45 ? 1 : 0);
    aura.scale.setScalar(s + clarao * 0.75);
    (aura.material as THREE.SpriteMaterial).opacity = Math.max(
      0.25,
      1 - curvaDeAnimacao(t, 0.6, 1.6) * 0.75,
    );
    semente.scale.setScalar(1 - curvaDeAnimacao(t, 0.45, 0.9) * 0.6);

    // ramos crescem
    for (const rm of ramos) {
      const prog = curvaDeAnimacao(t, rm.ini, rm.fim);
      const total = rm.geo.index ? rm.geo.index.count : 0;
      rm.geo.setDrawRange(0, Math.floor((total * prog) / 6) * 6);
    }

    // sol nasce, céu esquenta
    const solK = curvaDeAnimacao(t, 0.9, 2.4);
    sol.position.y = -16 + solK * 17.5;
    ceuMat.uniforms["uSol"]!.value = solK;
    hasteMat.uniforms["uSol"]!.value = solK;

    // vento: mouse em coordenadas do chão
    raio.setFromCamera(new THREE.Vector2(mx, -my), camera);
    if (raio.ray.intersectPlane(plano, ponto)) hasteMat.uniforms["uMouseMundo"]!.value.copy(ponto);
    (hasteMat.uniforms["uVento"]!.value as THREE.Vector2).set(
      mx,
      Math.min(1, Math.abs(amx - mx) * 6 + 0.3),
    );
    hasteMat.uniforms["uTime"]!.value = t;
    polenMat.uniforms["uTime"]!.value = t;
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
      const reg = (html.dataset["introBrilho"] ?? "") + `${t.toFixed(1)}:${Math.round(soma / 75)} `;
      html.dataset["introBrilho"] = reg;
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
