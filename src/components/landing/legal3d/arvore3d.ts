import * as THREE from "three";

/**
 * Árvore esculpida em 3D, gerada por código (sempre igual: semente fixa). Cada galho é um tubo de verdade com raio que afina
 * da base para a ponta; todos os galhos viram UMA geometria só (uma chamada de desenho). Cada vértice guarda `aNasce`, o
 * momento (0..1) em que aquele trecho aparece: o material descarta o que ainda não nasceu, então a árvore cresce da raiz à
 * copa conforme a leitura avança. As folhas são instâncias posicionadas nas pontas, com o momento em que brotam.
 */
export type Folha = { pos: THREE.Vector3; dir: THREE.Vector3; escala: number; nasce: number };

function rng(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Galho = { curva: THREE.CatmullRomCurve3; r0: number; r1: number; t0: number; t1: number };

export function gerarArvore(semente = 2410) {
  const r = rng(semente);
  const galhos: Galho[] = [];
  const folhas: Folha[] = [];
  const cima = new THREE.Vector3(0, 1, 0);

  function crescer(
    origem: THREE.Vector3,
    dir: THREE.Vector3,
    comp: number,
    raio: number,
    prof: number,
    t0: number,
  ) {
    const pts = [origem.clone()];
    const d = dir.clone().normalize();
    let p = origem.clone();
    const passos = 6;
    for (let i = 0; i < passos; i++) {
      // curva orgânica: desvia um pouco a cada trecho e tende a subir (fototropismo)
      d.add(new THREE.Vector3((r() - 0.5) * 0.35, (r() - 0.3) * 0.18, (r() - 0.5) * 0.35))
        .add(cima.clone().multiplyScalar(0.03))
        .normalize();
      p = p.clone().add(d.clone().multiplyScalar(comp / passos));
      pts.push(p);
    }
    const dur = 0.09 + 0.02 * (5 - prof);
    const t1 = t0 + dur;
    const raioFim = raio * 0.62;
    const curvaPai = new THREE.CatmullRomCurve3(pts);
    galhos.push({ curva: curvaPai, r0: raio, r1: raioFim, t0, t1 });
    if (prof >= 5 || comp < 0.28) {
      for (let k = 0; k < 4; k++) {
        const dirF = d
          .clone()
          .add(new THREE.Vector3(r() - 0.5, r() - 0.3, r() - 0.5).multiplyScalar(1.6))
          .normalize();
        folhas.push({
          pos: p.clone(),
          dir: dirF,
          escala: 0.75 + r() * 0.6,
          nasce: Math.min(0.99, t1 + k * 0.012),
        });
      }
      return;
    }
    const filhos = prof === 0 ? 4 : r() < 0.35 ? 3 : 2;
    for (let f = 0; f < filhos; f++) {
      // filhos espalhados em volta (ângulo áureo) e abertos em relação ao pai
      const az = (f / filhos) * Math.PI * 2 + r() * 1.2 + prof * 2.39;
      const abre = (prof === 0 ? 0.7 : 0.5) + r() * 0.35;
      const lateral = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const nd = d
        .clone()
        .multiplyScalar(Math.cos(abre))
        .add(lateral.multiplyScalar(Math.sin(abre)))
        .normalize();
      // nasce ao longo do último terço do pai
      const u = 0.62 + r() * 0.38;
      crescer(
        curvaPai.getPoint(u),
        nd,
        comp * (0.68 + r() * 0.12),
        raioFim * (0.82 + r() * 0.1),
        prof + 1,
        t0 + dur * u,
      );
    }
    // folhas ao longo dos galhos finos
    if (prof >= 3) {
      for (let k = 0; k < 2; k++) {
        const u = 0.35 + r() * 0.5;
        const pos = new THREE.CatmullRomCurve3(pts).getPoint(u);
        const dirF = new THREE.Vector3(r() - 0.5, r() * 0.6, r() - 0.5).normalize();
        folhas.push({
          pos,
          dir: dirF,
          escala: 0.55 + r() * 0.4,
          nasce: Math.min(0.99, t0 + dur * u + 0.03),
        });
      }
    }
  }

  // tronco (um pouco torcido) e raízes
  const tronco = [new THREE.Vector3(0, -3.6, 0)];
  for (let i = 1; i <= 6; i++)
    tronco.push(
      new THREE.Vector3(Math.sin(i * 0.9) * 0.09, -3.6 + i * 0.62, Math.cos(i * 1.3) * 0.07),
    );
  galhos.push({ curva: new THREE.CatmullRomCurve3(tronco), r0: 0.32, r1: 0.2, t0: 0, t1: 0.17 });
  const topo = tronco[tronco.length - 1]!;
  crescer(topo, new THREE.Vector3(0, 1, 0), 1.45, 0.2, 0, 0.15);
  for (let k = 0; k < 5; k++) {
    const az = (k / 5) * Math.PI * 2 + 0.4;
    const ini = new THREE.Vector3(0, -3.5, 0);
    const pts = [ini];
    for (let i = 1; i <= 4; i++)
      pts.push(
        new THREE.Vector3(
          Math.cos(az) * i * 0.24,
          -3.5 - i * 0.07 - i * i * 0.02,
          Math.sin(az) * i * 0.24,
        ),
      );
    galhos.push({ curva: new THREE.CatmullRomCurve3(pts), r0: 0.12, r1: 0.025, t0: 0.0, t1: 0.08 });
  }

  // normaliza o tempo para o desenho terminar perto do fim da leitura
  const fim = Math.max(...galhos.map((g) => g.t1), ...folhas.map((f) => f.nasce));
  const esc = 0.96 / fim;
  galhos.forEach((g) => ((g.t0 *= esc), (g.t1 *= esc)));
  folhas.forEach((f) => (f.nasce *= esc));

  return { geometria: tubos(galhos), folhas };
}

/** Todos os galhos num BufferGeometry só: anéis de 10 lados, raio afinando, com o atributo aNasce por vértice. */
function tubos(galhos: Galho[]) {
  const pos: number[] = [];
  const nor: number[] = [];
  const nasce: number[] = [];
  const idx: number[] = [];
  const LADOS = 10;
  for (const g of galhos) {
    const seg = Math.max(8, Math.round(g.curva.getLength() * 14));
    const quadros = g.curva.computeFrenetFrames(seg, false);
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const p = g.curva.getPointAt(t);
      const raio = g.r0 + (g.r1 - g.r0) * t;
      const N = quadros.normals[i]!;
      const B = quadros.binormals[i]!;
      for (let j = 0; j <= LADOS; j++) {
        const a = (j / LADOS) * Math.PI * 2;
        const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
        const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
        const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
        pos.push(p.x + nx * raio, p.y + ny * raio, p.z + nz * raio);
        nor.push(nx, ny, nz);
        nasce.push(g.t0 + (g.t1 - g.t0) * t);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < LADOS; j++) {
        const a = base + i * (LADOS + 1) + j;
        const b = a + LADOS + 1;
        // anti-horário visto de fora (a face externa é a da frente)
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("aNasce", new THREE.Float32BufferAttribute(nasce, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

/** Folha: lâmina levemente curvada (não é um plano chato), com a base na origem e apontando para +y. */
export function geometriaFolha() {
  const forma = new THREE.Shape();
  forma.moveTo(0, 0);
  forma.bezierCurveTo(0.09, 0.06, 0.1, 0.2, 0, 0.32);
  forma.bezierCurveTo(-0.1, 0.2, -0.09, 0.06, 0, 0);
  const geo = new THREE.ShapeGeometry(forma, 8);
  const p = geo.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, x * x * 2.2 - y * 0.12); // dobra na nervura e arqueia
  }
  geo.computeVertexNormals();
  return geo;
}
