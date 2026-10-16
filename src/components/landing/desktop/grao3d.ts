import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";

import { lacoVisivel, observarTamanho } from "./gl";

/**
 * Grãos de soja 3D flutuando nas laterais do hero (Three.js, só importado no desktop e só depois do carregamento).
 * Um único InstancedMesh (uma chamada de desenho para todos os grãos), geometria baixa, uma luz quente e uma
 * de contorno; a câmera acompanha o mouse e o grupo sobe com o scroll. Mantém o centro livre para o título.
 * Qualidade adaptativa: se a máquina não dá conta, baixa a resolução e, no limite, desliga.
 */
const TOTAL = 14;

export function iniciarGrao3d(hero: HTMLElement): () => void {
  const fundo = hero.querySelector<HTMLElement>(":scope > div");
  if (!fundo) return () => {};

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    return () => {};
  }
  const canvas = renderer.domElement;
  canvas.dataset["fx"] = "three";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  const svg = fundo.querySelector("svg");
  if (svg) fundo.insertBefore(canvas, svg);
  else fundo.appendChild(canvas);

  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const cena = new Scene();
  cena.fog = new Fog(new Color("#1a120a"), 11, 24);
  const camera = new PerspectiveCamera(35, 1.6, 0.1, 60);
  camera.position.set(0, 0, 14);

  cena.add(new AmbientLight(0xffe7c2, 0.9));
  const sol = new DirectionalLight(0xffc680, 2.4);
  sol.position.set(-5, 6, 8);
  cena.add(sol);
  const contorno = new DirectionalLight(0xfff1d6, 1.1);
  contorno.position.set(6, -3, -4);
  cena.add(contorno);

  // Grão de soja: esfera achatada, cor de grão maduro, brilho suave.
  const geometria = new SphereGeometry(1, 22, 14);
  geometria.scale(1, 0.84, 0.78);
  const material = new MeshStandardMaterial({
    color: new Color("#dcc08a"),
    roughness: 0.58,
    metalness: 0.04,
  });
  const graos = new InstancedMesh(geometria, material, TOTAL);
  const grupo = new Group();
  grupo.add(graos);
  cena.add(grupo);

  type Grao = {
    x: number;
    y: number;
    z: number;
    s: number;
    vx: number;
    vy: number;
    vz: number;
    fase: number;
    lado: number;
  };
  const dados: Grao[] = [];
  const preencher = (aspecto: number) => {
    dados.length = 0;
    const tanMeio = Math.tan(MathUtils.degToRad(camera.fov / 2));
    for (let i = 0; i < TOTAL; i++) {
      const lado = i % 2 ? 1 : -1;
      const z = MathUtils.randFloat(-7, 2.5);
      // meio-campo visível NESSA profundidade; faixa lateral do ~74% ao ~104% dele (centro livre p/ o título)
      const meio = tanMeio * (camera.position.z - z) * aspecto;
      const x = lado * meio * MathUtils.randFloat(0.74, 1.04);
      dados.push({
        x,
        y: MathUtils.randFloat(-4.2, 4.2),
        z,
        s: MathUtils.mapLinear(z, -7, 2.5, 0.22, 0.62),
        vx: MathUtils.randFloat(0.1, 0.45),
        vy: MathUtils.randFloat(0.1, 0.4),
        vz: MathUtils.randFloat(0.05, 0.3),
        fase: Math.random() * Math.PI * 2,
        lado,
      });
    }
  };

  const ajudante = new Object3D();
  let alvoX = 0;
  let alvoY = 0;
  let cx = 0;
  let cy = 0;
  const aoMover = (e: PointerEvent) => {
    alvoX = (e.clientX / window.innerWidth) * 2 - 1;
    alvoY = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  const desfazerTamanho = observarTamanho(fundo, (w, h) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    preencher(camera.aspect);
  });

  let media = 16;
  let quadros = 0;
  const parar = lacoVisivel(hero, (agora, dt) => {
    const t = agora / 1000;
    cx += (alvoX - cx) * 0.05;
    cy += (alvoY - cy) * 0.05;
    camera.position.x = cx * 0.9;
    camera.position.y = -cy * 0.6;
    camera.lookAt(0, 0, 0);
    grupo.position.y = window.scrollY * 0.004;

    dados.forEach((g, i) => {
      ajudante.position.set(
        g.x + Math.sin(t * 0.3 + g.fase) * 0.25 * g.lado,
        g.y + Math.sin(t * 0.4 + g.fase) * 0.35,
        g.z,
      );
      ajudante.rotation.set(t * g.vx + g.fase, t * g.vy, t * g.vz);
      ajudante.scale.setScalar(g.s);
      ajudante.updateMatrix();
      graos.setMatrixAt(i, ajudante.matrix);
    });
    graos.instanceMatrix.needsUpdate = true;
    renderer.render(cena, camera);

    media = media * 0.94 + Math.min(dt, 100) * 0.06;
    if (++quadros % 90 === 0) {
      if (media > 26 && dpr > 1) {
        dpr = 1;
        renderer.setPixelRatio(1);
        renderer.setSize(fundo.clientWidth, fundo.clientHeight, false);
      } else if (media > 45) {
        canvas.style.display = "none";
      }
    }
  });

  return () => {
    parar();
    desfazerTamanho();
    window.removeEventListener("pointermove", aoMover);
    geometria.dispose();
    material.dispose();
    graos.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
