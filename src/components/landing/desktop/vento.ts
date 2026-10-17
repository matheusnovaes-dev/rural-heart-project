import { criarCanvasGl, criarPrograma, lacoVisivel, observarTamanho } from "./gl";

/**
 * Vento na lavoura: a própria foto do hero é redesenhada em WebGL com um shader que ondula o trigo (mais
 * forte na parte de baixo, onde está a plantação) e com uma onda que nasce no cursor e se espalha quando o
 * mouse se move, com um leve desvio de cor nas bordas da onda. A foto de <picture> continua por baixo até o
 * primeiro quadro e volta a aparecer se o efeito for desligado. Um quadrilátero, uma textura, sem geometria.
 */
const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `
precision mediump float;
varying vec2 v;
uniform sampler2D tex;
uniform vec2 r; uniform vec2 ti; uniform float t; uniform vec2 m; uniform float e; uniform float sc;
void main(){
  float ra = r.x / r.y;
  float ta = ti.x / ti.y;
  vec2 s = ra > ta ? vec2(1.0, ta / ra) : vec2(ra / ta, 1.0);
  s *= 0.9;
  vec2 uv = (vec2(v.x, 1.0 - v.y) - 0.5) * s + 0.5;
  uv.y += sc * 0.035;

  float chao = smoothstep(0.75, 0.12, v.y);
  float w1 = sin(v.x * 7.0 + t * 0.8 + v.y * 3.0);
  float w2 = sin(v.x * 19.0 - t * 1.4 + v.y * 9.0);
  vec2 d = vec2(w1 * 0.0042 + w2 * 0.0020, w1 * 0.0011) * (0.2 + chao);

  vec2 pm = (v - m) * vec2(ra, 1.0);
  float dist = length(pm);
  float onda = sin(dist * 36.0 - t * 5.0) * exp(-dist * 4.2) * e;
  d += normalize(pm + 1e-4) / vec2(ra, 1.0) * onda * 0.016;

  vec2 u = uv + d;
  float ca = 0.0018 * e;
  vec3 col = vec3(texture2D(tex, u + vec2(ca, 0.0)).r, texture2D(tex, u).g, texture2D(tex, u - vec2(ca, 0.0)).b);
  float varre = sin(v.x * 2.0 - t * 0.25) * 0.5 + 0.5;
  col += vec3(1.0, 0.75, 0.4) * 0.035 * varre * chao;
  gl_FragColor = vec4(col, 1.0);
}`;

export function iniciarVento(hero: HTMLElement): () => void {
  const fundo = hero.querySelector<HTMLElement>(":scope > div");
  const figura = hero.querySelector<HTMLPictureElement>("picture");
  const foto = figura?.querySelector("img");
  const camada = figura?.parentElement; // div com o parallax da foto
  if (!fundo || !figura || !foto || !camada) return () => {};

  const base = criarCanvasGl(fundo, { posicao: "primeiro" });
  if (!base) return () => {};
  const { canvas, gl } = base;
  // logo depois da foto e antes do gradiente escuro, para o gradiente continuar por cima
  camada.after(canvas);

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

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uR = u("r");
  const uTi = u("ti");
  const uT = u("t");
  const uM = u("m");
  const uE = u("e");
  const uSc = u("sc");

  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  const desfazerTamanho = observarTamanho(fundo, (w, h) => {
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uR, canvas.width, canvas.height);
  });

  // Textura: a mesma imagem que o <picture> já carregou (vem do cache do navegador).
  const textura = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textura);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  let pronta = false;
  let escondeu = false;
  let desligado = false;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    if (desligado) return;
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.uniform2f(uTi, img.naturalWidth, img.naturalHeight);
    pronta = true;
  };
  img.src = foto.currentSrc || foto.src;

  let alvoX = 0.5;
  let alvoY = 0.5;
  let mx = 0.5;
  let my = 0.5;
  let energia = 0;
  let ultimoX = 0;
  let ultimoY = 0;
  const aoMover = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    alvoX = (e.clientX - r.left) / r.width;
    alvoY = 1 - (e.clientY - r.top) / r.height;
    energia = Math.min(1, energia + Math.hypot(e.clientX - ultimoX, e.clientY - ultimoY) * 0.012);
    ultimoX = e.clientX;
    ultimoY = e.clientY;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  const mostrarFoto = () => {
    figura.style.visibility = "";
    escondeu = false;
  };
  let media = 16;
  let quadros = 0;
  const parar = lacoVisivel(hero, (agora, dt) => {
    if (!pronta) return;
    mx += (alvoX - mx) * 0.12;
    my += (alvoY - my) * 0.12;
    energia *= 0.94;
    gl.uniform1f(uT, agora / 1000);
    gl.uniform2f(uM, mx, my);
    gl.uniform1f(uE, energia);
    gl.uniform1f(uSc, Math.min(1, window.scrollY / Math.max(hero.clientHeight, 1)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!escondeu) {
      figura.style.visibility = "hidden";
      escondeu = true;
    }
    media = media * 0.94 + Math.min(dt, 100) * 0.06;
    if (++quadros % 90 === 0 && media > 40) {
      // não dá conta: volta para a foto normal
      desligado = true;
      canvas.style.display = "none";
      mostrarFoto();
    }
  });

  return () => {
    desligado = true;
    parar();
    desfazerTamanho();
    window.removeEventListener("pointermove", aoMover);
    mostrarFoto();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
