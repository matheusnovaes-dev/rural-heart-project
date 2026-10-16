import { useEffect, useState } from "react";

/**
 * Diz se esta visita pode receber os efeitos pesados da versão desktop (WebGL, cursor próprio, scroll
 * suave...): tela larga, mouse de verdade, sem pedido de menos movimento, sem economia de dados e com
 * máquina razoável. Começa falso (o servidor e o celular nunca montam nada) e só vira verdadeiro depois que
 * a página carregou e o navegador ficou ocioso, então os efeitos nunca disputam a CPU com o primeiro desenho.
 */
export function useDesktopFino() {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const largo = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    const maquinaFraca =
      nav.connection?.saveData === true ||
      (nav.deviceMemory !== undefined && nav.deviceMemory < 4) ||
      (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4);
    if (maquinaFraca) return;

    let ocioso: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const liberar = () => setOk(largo.matches && !reduz.matches);
    const agendar = () => {
      if ("requestIdleCallback" in window)
        ocioso = window.requestIdleCallback(liberar, { timeout: 2500 });
      else timer = setTimeout(liberar, 800);
    };
    const aoMudar = () => {
      if (!largo.matches || reduz.matches) setOk(false);
      else agendar();
    };

    if (document.readyState === "complete") agendar();
    else window.addEventListener("load", agendar, { once: true });
    largo.addEventListener("change", aoMudar);
    reduz.addEventListener("change", aoMudar);
    return () => {
      window.removeEventListener("load", agendar);
      largo.removeEventListener("change", aoMudar);
      reduz.removeEventListener("change", aoMudar);
      if (ocioso !== undefined) window.cancelIdleCallback(ocioso);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return ok;
}
