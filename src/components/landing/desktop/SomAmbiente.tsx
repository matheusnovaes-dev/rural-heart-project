import { useEffect, useRef, useState } from "react";

import somCampo from "@/assets/som/campo.m4a?url";

/**
 * Som ambiente opcional do desktop (a ideia do botão de áudio do Active Theory): vento no campo, uma base grave e
 * passarinhos ao longe, trilha original sintetizada por código (48 s em loop sem emenda, ~390 KB). Começa SEMPRE
 * desligado; o arquivo só é baixado no primeiro clique. Liga e desliga com fade, pausa sozinho com a aba escondida e
 * volta quando ela reaparece. Fica no canto inferior esquerdo, e só aparece depois que o aviso de cookies sai.
 */
const VOLUME = 0.5;

export default function SomAmbiente() {
  // "carregando": o arquivo baixa no primeiro clique; o botão avisa e ignora cliques até o som começar
  const [estado, setEstado] = useState<"desligado" | "carregando" | "ligado">("desligado");
  const ligado = estado === "ligado";
  // Enquanto o aviso de cookies está aberto (ele publica --cookie-h no <html>), o botão fica escondido no mesmo canto:
  // ele nunca se move debaixo do mouse (o primeiro toque fecha o aviso; se o botão descesse junto, o clique se perdia).
  const [avisoAberto, setAvisoAberto] = useState(true);
  useEffect(() => {
    const raiz = document.documentElement;
    const ler = () =>
      setAvisoAberto(parseFloat(raiz.style.getPropertyValue("--cookie-h") || "0") > 0);
    ler();
    const mo = new MutationObserver(ler);
    mo.observe(raiz, { attributes: true, attributeFilter: ["style"] });
    return () => mo.disconnect();
  }, []);
  const audio = useRef<HTMLAudioElement | null>(null);
  const rampa = useRef(0);

  const fade = (alvo: number, aoTerminar?: () => void) => {
    const a = audio.current;
    if (!a) return;
    cancelAnimationFrame(rampa.current);
    const ini = a.volume;
    const t0 = performance.now();
    const passo = (agora: number) => {
      const k = Math.min(1, (agora - t0) / 1200);
      a.volume = ini + (alvo - ini) * k;
      if (k < 1) rampa.current = requestAnimationFrame(passo);
      else aoTerminar?.();
    };
    rampa.current = requestAnimationFrame(passo);
  };

  function alternar() {
    if (estado === "carregando") return;
    if (!ligado) {
      setEstado("carregando");
      if (!audio.current) {
        const a = new Audio(somCampo);
        a.loop = true;
        a.preload = "auto";
        a.volume = 0;
        audio.current = a;
      }
      audio.current
        .play()
        .then(() => {
          setEstado("ligado");
          fade(VOLUME);
        })
        .catch(() => {
          // navegador recusou tocar: fica desligado, sem barulho de erro
          setEstado("desligado");
        });
    } else {
      setEstado("desligado");
      fade(0, () => audio.current?.pause());
    }
  }

  useEffect(() => {
    if (!ligado) return;
    const aoMudar = () => {
      const a = audio.current;
      if (!a) return;
      if (document.hidden) a.pause();
      else void a.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, [ligado]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rampa.current);
      audio.current?.pause();
    },
    [],
  );

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={ligado}
      aria-busy={estado === "carregando"}
      aria-label={ligado ? "Desligar som ambiente" : "Ligar som ambiente"}
      className="fixed left-6 z-40 inline-flex items-center gap-2.5 rounded-full border border-border bg-background/95 px-3.5 py-2 text-xs font-semibold tracking-[0.18em] text-foreground uppercase shadow-sm transition-colors hover:border-[color:var(--cta)]"
      style={{
        bottom: "1.5rem",
        opacity: avisoAberto ? 0 : 1,
        pointerEvents: avisoAberto ? "none" : "auto",
        transition: "opacity .5s ease, border-color .2s",
      }}
      tabIndex={avisoAberto ? -1 : 0}
    >
      <span aria-hidden="true" className="flex h-3.5 items-end gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`som-barra w-[3px] rounded-full bg-[color:var(--cta)] ${ligado ? "som-barra-ligada" : estado === "carregando" ? "animate-pulse" : ""}`}
            style={{ animationDelay: `${i * 0.13}s` }}
          />
        ))}
      </span>
      {estado === "carregando" ? "Carregando…" : `Som ${ligado ? "ligado" : "desligado"}`}
    </button>
  );
}
