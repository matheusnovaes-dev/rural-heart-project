import type { PointerEvent } from "react";

/**
 * Brilho que acompanha o cursor (classe `.spot` em styles.css) e, nos cartões com `data-tilt`, uma leve inclinação 3D.
 * Só reage a mouse de verdade: no toque não faz nada, então o celular não paga o custo.
 */
export function aoMoverSpotlight(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  el.style.setProperty("--mx", `${x}px`);
  el.style.setProperty("--my", `${y}px`);
  if (el.dataset["tilt"] !== undefined && r.width > 0 && r.height > 0) {
    el.style.setProperty("--ry", `${((x / r.width - 0.5) * 6).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-(y / r.height - 0.5) * 6).toFixed(2)}deg`);
  }
}

export function aoSairSpotlight(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
}
