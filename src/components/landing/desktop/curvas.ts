import { criarPrograma } from "./gl";

/**
 * Curvas de nível (como as linhas topográficas do site do Lando Norris, e as curvas de nível que o produtor conhece do
 * mapa da fazenda) atrás das seções claras do desktop. Um único canvas fixo do tamanho da tela fica atrás de toda a
 * página (z-index -1): seções com fundo próprio o cobrem e as claras deixam ver as linhas. O shader desenha as isolinhas
 * de um relevo de ruído que deriva devagar; a rolagem desloca o relevo e o mouse levanta um morro que dobra as curvas em
 * volta do cursor (e as acende de leve). Só aparece nas seções da lista (as do mapa do Brasil já têm desenho próprio);
 * nas outras some com fade. 30 quadros por segundo, desiste sozinho em máquina lenta, para com a aba escondida.
 */
const SECOES = ["problema", "painel", "duvidas", "comece"];

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
uniform vec2 r; uniform float t; uniform vec2 m; uniform float s; uniform float o; uniform float px;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  float asp = r.x / r.y;
  vec2 p = vec2(uv.x * asp, uv.y) * 1.15 + vec2(0.0, -s);
  float e = fbm(p + vec2(t * 0.010, -t * 0.006));
  vec2 d = (uv - m) * vec2(asp, 1.0);
  float morro = exp(-dot(d, d) * 9.0);
  e += 0.16 * morro;
  float k = e * 15.0;
  float w = fwidth(k);
  float linha = 1.0 - smoothstep(0.0, 1.1 * px, abs(fract(k - 0.5) - 0.5) / max(w, 1e-4));
  float mestra = 1.0 - step(0.5, mod(floor(k + 0.5), 5.0));
  float borda = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
  float a = linha * (0.09 + 0.07 * mestra + 0.22 * morro) * borda * o;
  vec3 tinta = mix(vec3(0.16, 0.27, 0.19), vec3(0.93, 0.58, 0.17), morro * 0.85);
  gl_FragColor = vec4(tinta * a, a);
}`;

export function iniciarCurvas(dprMax = 1.5): () => void {
  const secoes = SECOES.map((id) => document.getElementById(id)).filter(
    (e): e is HTMLElement => !!e,
  );
  if (!secoes.length) return () => {};
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset["fx"] = "curvas";
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:-1;opacity:1";
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl || !gl.getExtension("OES_standard_derivatives")) return () => {};
  const prog = criarPrograma(gl, VS, FS);
  if (!prog) return () => {};
  document.body.appendChild(canvas);
  const raiz = document.documentElement;
  raiz.classList.add("curvas-ativas");
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pLoc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(pLoc);
  gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const u = (nome: string) => gl.getUniformLocation(prog, nome);
  const uR = u("r"),
    uT = u("t"),
    uM = u("m"),
    uS = u("s"),
    uO = u("o"),
    uPx = u("px");

  // Linhas finas pedem resolução real (no máximo 1,5x para não pesar em tela retina).
  let dpr = Math.min(window.devicePixelRatio || 1, dprMax);
  const ajustar = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uPx, dpr);
  };
  ajustar();
  window.addEventListener("resize", ajustar);

  // Quais seções da lista estão na tela agora: as curvas só aparecem quando alguma ocupa o meio da tela.
  const naTela = new Set<Element>();
  const io = new IntersectionObserver(
    (entradas) =>
      entradas.forEach((en) =>
        en.isIntersecting ? naTela.add(en.target) : naTela.delete(en.target),
      ),
    { rootMargin: "-35% 0px -35% 0px" },
  );
  secoes.forEach((s) => io.observe(s));

  let alvoX = 0.5,
    alvoY = 0.5,
    mx = 0.5,
    my = 0.5;
  const aoMover = (e: PointerEvent) => {
    alvoX = e.clientX / window.innerWidth;
    alvoY = 1 - e.clientY / window.innerHeight;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  let opacidade = 0,
    raf = 0,
    ultimo = 0,
    alterna = false,
    media = 33,
    quadros = 0,
    desistiu = false;
  const quadro = (agora: number) => {
    raf = 0;
    if (desistiu || document.hidden) return;
    const alvo = naTela.size > 0 ? 1 : 0;
    opacidade += (alvo - opacidade) * 0.06;
    // Nada a mostrar e já apagado: dorme até uma seção da lista entrar na tela.
    if (alvo === 0 && opacidade < 0.01) {
      opacidade = 0;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      ultimo = 0;
      return;
    }
    raf = requestAnimationFrame(quadro);
    alterna = !alterna;
    if (alterna) return;
    const dt = ultimo ? agora - ultimo : 33;
    ultimo = agora;
    media = media * 0.9 + Math.min(dt, 200) * 0.1;
    // Lento (menos de ~15 quadros por segundo nesta camada a 30): primeiro baixa a resolução; no limite, desiste.
    if (++quadros > 60 && media > 66) {
      quadros = 0;
      media = 33;
      if (dpr > 0.6) {
        dpr = Math.max(0.6, dpr * 0.67);
        ajustar();
      } else {
        desistiu = true;
        canvas.remove();
        raiz.classList.remove("curvas-ativas");
        return;
      }
    }
    mx += (alvoX - mx) * 0.06;
    my += (alvoY - my) * 0.06;
    gl.uniform1f(uT, agora / 1000);
    gl.uniform2f(uM, mx, my);
    gl.uniform1f(uS, (window.scrollY / window.innerHeight) * 0.35);
    gl.uniform1f(uO, opacidade);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const acordar = () => {
    if (!raf && !desistiu && !document.hidden) raf = requestAnimationFrame(quadro);
  };
  // O IntersectionObserver e a rolagem acordam o laço (ele dorme quando não há seção clara na tela).
  const io2 = new IntersectionObserver(acordar, { rootMargin: "-35% 0px -35% 0px" });
  secoes.forEach((s) => io2.observe(s));
  document.addEventListener("visibilitychange", acordar);
  acordar();

  return () => {
    desistiu = true;
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    io2.disconnect();
    window.removeEventListener("resize", ajustar);
    window.removeEventListener("pointermove", aoMover);
    document.removeEventListener("visibilitychange", acordar);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    raiz.classList.remove("curvas-ativas");
  };
}
