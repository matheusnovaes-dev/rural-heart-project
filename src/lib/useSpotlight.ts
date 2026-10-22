import type { PointerEvent } from "react";

/**
 * Brilho que acompanha o cursor (classe `.spot` em styles.css). Só reage a mouse de verdade: no toque não faz nada, então
 * o celular não paga o custo e não fica com "brilho preso" depois de um toque.
 */
export function aoMoverSpotlight(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}
