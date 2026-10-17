import plexMono500 from "@/assets/fontes/plexmono-500.woff2?url";
import plexMono600 from "@/assets/fontes/plexmono-600.woff2?url";
import instrumentSerif from "@/assets/fontes/instrumentserif-destaque.woff2?url";
import caveatBrush from "@/assets/fontes/caveatbrush-destaque.woff2?url";

/**
 * Carregamento sob demanda de folhas de fontes (Google Fonts). Cada URL entra no <head> no máximo uma vez.
 * A landing só carrega no começo o que aparece nela; as fontes do painel (DM Sans e Space Grotesk) só vêm quando o
 * mockup do painel está perto de aparecer, ou no próprio /dashboard.
 */
export const FONTES_PAINEL_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Space+Grotesk:wght@500;600;700&display=swap";

export function carregarFonte(href: string) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Fontes de destaque da landing (números em IBM Plex Mono, serifa Instrument Serif dos títulos e o traço Caveat Brush),
 * do próprio domínio e só com os caracteres usados: sem CSS nem conexão com o Google, e chamadas depois da hidratação pra
 * não disputar banda com a foto do hero. Entram com `swap`, como antes.
 */
export function carregarFontesDaLanding() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const lista: [string, string, string][] = [
    ["IBM Plex Mono", plexMono500, "500"],
    ["IBM Plex Mono", plexMono600, "600"],
    ["Instrument Serif", instrumentSerif, "400"],
    ["Caveat Brush", caveatBrush, "400"],
  ];
  for (const [familia, url, peso] of lista) {
    const fonte = new FontFace(familia, `url(${url}) format("woff2")`, {
      weight: peso,
      style: "normal",
      display: "swap",
    });
    document.fonts.add(fonte);
    fonte.load().catch(() => {});
  }
}
