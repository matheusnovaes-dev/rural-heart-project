/** Utilidades mínimas de WebGL cru (sem three.js: o efeito inteiro cabe em poucos KB). */

export function criarCanvasGl(
  alvo: HTMLElement,
  opcoes: { posicao: "primeiro" | "antesDoSvg"; zIndex?: string },
): { canvas: HTMLCanvasElement; gl: WebGLRenderingContext } | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset["fx"] = "gl";
  canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;${
    opcoes.zIndex ? `z-index:${opcoes.zIndex};` : ""
  }`;
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const svg = opcoes.posicao === "antesDoSvg" ? alvo.querySelector("svg") : null;
  if (svg) alvo.insertBefore(canvas, svg);
  else alvo.insertBefore(canvas, alvo.firstChild);
  return { canvas, gl };
}

export function criarPrograma(
  gl: WebGLRenderingContext,
  vs: string,
  fs: string,
): WebGLProgram | null {
  const compilar = (tipo: number, fonte: string) => {
    const sh = gl.createShader(tipo);
    if (!sh) return null;
    gl.shaderSource(sh, fonte);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const v = compilar(gl.VERTEX_SHADER, vs);
  const f = compilar(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  return prog;
}

/** Acompanha tamanho (em px reais) de um elemento com ResizeObserver. */
export function observarTamanho(
  el: HTMLElement,
  aoMudar: (largura: number, altura: number) => void,
): () => void {
  const ro = new ResizeObserver(() => aoMudar(el.clientWidth, el.clientHeight));
  ro.observe(el);
  return () => ro.disconnect();
}

/** Só roda o desenho enquanto o elemento está na tela e a aba está visível. */
export function lacoVisivel(
  el: Element,
  quadro: (agora: number, dt: number) => void,
  aoSair?: () => void,
): () => void {
  let visivel = false;
  let raf = 0;
  let ultimo = 0;
  let parado = false;
  const passo = (agora: number) => {
    raf = 0;
    if (parado || !visivel || document.hidden) return;
    const dt = ultimo ? agora - ultimo : 16;
    ultimo = agora;
    quadro(agora, dt);
    raf = requestAnimationFrame(passo);
  };
  const acordar = () => {
    if (!raf && visivel && !document.hidden && !parado) {
      ultimo = 0;
      raf = requestAnimationFrame(passo);
    }
  };
  const io = new IntersectionObserver(
    ([e]) => {
      visivel = !!e?.isIntersecting;
      acordar();
    },
    { rootMargin: "80px" },
  );
  io.observe(el);
  document.addEventListener("visibilitychange", acordar);
  return () => {
    parado = true;
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener("visibilitychange", acordar);
    aoSair?.();
  };
}
