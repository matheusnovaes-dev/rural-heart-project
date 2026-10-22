/**
 * Nível da máquina para os efeitos do desktop, como fazem os sites premiados (Active Theory, Lusion, Bruno Simon usam
 * "GPU tiers"): em vez de ligar tudo e só depois descobrir que travou, olha a placa de vídeo pelo nome que o WebGL
 * informa (WEBGL_debug_renderer_info) e o processador/memória que o navegador expõe.
 *  - "baixa": sem aceleração de vídeo (SwiftShader, llvmpipe, "Microsoft Basic Render") ou gráfico Intel antigo
 *    (HD 2000 a 6100, GMA, HD sem número): nada de WebGL nem rolagem suave; ficam só efeitos de CSS e as versões paradas.
 *  - "media": Intel HD/UHD mais novos, Radeon integradas, até 4 núcleos ou 4 GB: tudo liga, com resolução e quantidade
 *    de partículas reduzidas.
 *  - "alta": o resto (Apple M, NVIDIA, Radeon dedicadas, Iris Xe, Arc).
 * Cada efeito continua medindo os quadros por segundo e baixando a resolução antes de desistir. Calculado uma vez.
 */
export type Nivel = "alta" | "media" | "baixa";

let cache: Nivel | null = null;

export function nomeDaPlaca(): string {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const nome = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return nome;
  } catch {
    return "";
  }
}

export function classificar(placa: string, nucleos: number, memoriaGb: number): Nivel {
  const r = placa.toLowerCase();
  if (!r) return "baixa"; // sem WebGL
  if (
    /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|mesa offscreen|software rasterizer/.test(
      r,
    )
  )
    return "baixa";
  const intel = r.includes("intel");
  if (intel && !/iris|uhd|arc/.test(r)) {
    if (
      /gma|hd graphics (2000|2500|3000|4000|4200|4400|4600|5000|5100|5200|5300|5500|5600|6000|6100)\b/.test(
        r,
      )
    )
      return "baixa";
    if (/hd graphics(?! \d)/.test(r)) return "baixa"; // "Intel HD Graphics" sem número: Atom/Celeron antigos
  }
  if (nucleos <= 2 || memoriaGb <= 2) return "baixa";
  if (intel && !/iris\(r\) xe|iris xe|arc/.test(r)) return "media";
  if (/radeon.*(\br[2-7]\b|vega (3|6|8)\b|graphics)/.test(r)) return "media";
  if (nucleos <= 4 || memoriaGb <= 4) return "media";
  return "alta";
}

export function nivelDaMaquina(): Nivel {
  if (cache) return cache;
  const nav = navigator as Navigator & { deviceMemory?: number };
  cache = classificar(nomeDaPlaca(), nav.hardwareConcurrency ?? 4, nav.deviceMemory ?? 8);
  if (typeof document !== "undefined") document.documentElement.dataset["fxNivel"] = cache;
  return cache;
}
