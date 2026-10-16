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
