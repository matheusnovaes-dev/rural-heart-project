import { criarCanvasGl, criarPrograma, lacoVisivel, observarTamanho } from "./gl";

// Brilho laranja que escorre (ruído fractal) atrás da faixa gigante, com uma luz que segue o mouse.
const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `
precision mediump float;
uniform vec2 r; uniform float t; uniform vec2 m;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * n(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = uv * vec2(r.x / r.y, 1.0) * 1.6;
  float q = fbm(p + vec2(t * 0.05, t * 0.03));
  float w = fbm(p + 3.0 * q + vec2(-t * 0.04, t * 0.06));
  float g = smoothstep(0.38, 0.92, w);
  vec2 d = (uv - m) * vec2(r.x / r.y, 1.0);
  float spot = exp(-dot(d, d) * 5.0);
  float a = g * 0.34 + spot * 0.4;
  gl_FragColor = vec4(vec3(0.91, 0.57, 0.16) * a, a);
}`;

export function iniciarFluxo(secao: HTMLElement): () => void {
  const base = criarCanvasGl(secao, { posicao: "primeiro", zIndex: "-1" });
  if (!base) return () => {};
  const { canvas, gl } = base;
  secao.dataset["glow"] = "1"; // esconde o brilho em CSS do celular: aqui o WebGL assume
  const prog = criarPrograma(gl, VS, FS);
  if (!prog) {
    canvas.remove();
    return () => {};
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pLoc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(pLoc);
  gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const uR = gl.getUniformLocation(prog, "r");
  const uT = gl.getUniformLocation(prog, "t");
  const uM = gl.getUniformLocation(prog, "m");

  // Resolução reduzida (o brilho é borrado de propósito) e 30 quadros por segundo: bem leve.
  const escala = 0.5;
  const desfazerTamanho = observarTamanho(secao, (w, h) => {
    canvas.width = Math.max(1, Math.round(w * escala));
    canvas.height = Math.max(1, Math.round(h * escala));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uR, canvas.width, canvas.height);
  });

  let alvoX = 0.5;
  let alvoY = 0.5;
  let mx = 0.5;
  let my = 0.5;
  const aoMover = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    alvoX = (e.clientX - r.left) / r.width;
    alvoY = 1 - (e.clientY - r.top) / r.height;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  let alterna = false;
  let media = 33;
  let quadros = 0;
  const parar = lacoVisivel(secao, (agora, dt) => {
    alterna = !alterna;
    if (alterna) return;
    // Se a máquina não dá conta nem de 30 quadros por segundo com este brilho, desiste dele.
    media = media * 0.9 + Math.min(dt, 200) * 0.1;
    if (++quadros > 60 && media > 90) {
      canvas.style.display = "none";
      return;
    }
    mx += (alvoX - mx) * 0.08;
    my += (alvoY - my) * 0.08;
    gl.uniform1f(uT, agora / 1000);
    gl.uniform2f(uM, mx, my);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });

  return () => {
    delete secao.dataset["glow"];
    parar();
    desfazerTamanho();
    window.removeEventListener("pointermove", aoMover);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
