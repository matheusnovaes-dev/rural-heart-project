import { criarCanvasGl, criarPrograma, lacoVisivel, observarTamanho } from "./gl";

// Poeira dourada de grãos subindo pelo hero. Cada partícula tem 4 números fixos (posição, velocidade, fase);
// toda a animação (subida, balanço, fuga do mouse) é calculada na GPU a partir do tempo.
const VS = `
attribute vec4 a;
uniform float t; uniform vec2 m; uniform float asp; uniform float dpr; uniform float sc;
varying float v;
void main(){
  float vel = 0.010 + a.z * 0.045;
  float y = fract(a.y + t * vel + sc);
  float x = a.x + sin(t * 0.35 + a.w * 6.2831) * 0.035 + y * 0.05;
  vec2 p = vec2(x, y) * 2.0 - 1.0;
  vec2 d = (p - m) * vec2(asp, 1.0);
  float f = exp(-dot(d, d) * 9.0);
  p += normalize(d + 0.0001) * f * 0.2 * vec2(1.0 / asp, 1.0);
  float fade = smoothstep(0.0, 0.14, y) * smoothstep(1.0, 0.75, y);
  v = fade * (0.3 + a.z * 0.7) * (1.0 + f * 1.4);
  gl_Position = vec4(p, 0.0, 1.0);
  gl_PointSize = (1.5 + a.z * 4.5 + f * 3.5) * dpr;
}`;
const FS = `
precision mediump float;
varying float v;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float k = smoothstep(0.5, 0.0, d);
  k = k * k * v;
  gl_FragColor = vec4(vec3(1.0, 0.74, 0.34) * k, k);
}`;

export function iniciarParticulas(hero: HTMLElement): () => void {
  const fundo = hero.querySelector<HTMLElement>(":scope > div");
  if (!fundo) return () => {};
  const base = criarCanvasGl(fundo, { posicao: "antesDoSvg" });
  if (!base) return () => {};
  const { canvas, gl } = base;
  const prog = criarPrograma(gl, VS, FS);
  if (!prog) {
    canvas.remove();
    return () => {};
  }
  gl.useProgram(prog);

  const TOTAL = 1100;
  const dados = new Float32Array(TOTAL * 4);
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random();
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, dados, gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uT = u("t");
  const uM = u("m");
  const uAsp = u("asp");
  const uDpr = u("dpr");
  const uSc = u("sc");

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  gl.uniform1f(uDpr, dpr);
  const desfazerTamanho = observarTamanho(fundo, (w, h) => {
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uAsp, w / Math.max(h, 1));
  });

  // Mouse em coordenadas do canvas (-1..1), suavizado.
  let alvoX = 2;
  let alvoY = 2;
  let mx = 2;
  let my = 2;
  const aoMover = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    alvoX = ((e.clientX - r.left) / r.width) * 2 - 1;
    alvoY = 1 - ((e.clientY - r.top) / r.height) * 2;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  let quantas = TOTAL;
  let quadros = 0;
  let media = 16;
  let desistiu = false;
  const parar = lacoVisivel(
    hero,
    (agora, dt) => {
      mx += (alvoX - mx) * 0.12;
      my += (alvoY - my) * 0.12;
      gl.uniform1f(uT, agora / 1000);
      gl.uniform2f(uM, mx, my);
      gl.uniform1f(uSc, window.scrollY * 0.00012);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, quantas);

      // Qualidade adaptativa: se a máquina não dá conta, reduz as partículas e, no limite, desiste.
      media = media * 0.94 + Math.min(dt, 100) * 0.06;
      if (++quadros % 90 === 0) {
        if (media > 24 && quantas > 250) quantas = Math.floor(quantas * 0.6);
        else if (media > 42 && !desistiu) {
          desistiu = true;
          canvas.style.display = "none";
        }
      }
    },
    undefined,
  );
  const aoPerder = (e: Event) => {
    e.preventDefault();
    parar();
  };
  canvas.addEventListener("webglcontextlost", aoPerder);

  return () => {
    parar();
    desfazerTamanho();
    window.removeEventListener("pointermove", aoMover);
    canvas.removeEventListener("webglcontextlost", aoPerder);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
