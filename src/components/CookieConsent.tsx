import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

const CHAVE_LOCALSTORAGE = "safralume_cookie_consent";

/**
 * Aviso de cookies (LGPD). Só informativo: avisa e linka pra /privacidade, não
 * bloqueia o Pixel de disparar (gating de verdade pausaria a atribuição real
 * que os anúncios já dependem hoje — mudança maior, fora do escopo deste aviso).
 *
 * Formato compacto de propósito (auditoria de UX 2026-10-13): a barra
 * anterior ocupava 117px, 14% da tela do celular, em toda primeira visita, e
 * cobria o botão do WhatsApp. Agora é um cartão de ~64px, aparece depois de
 * ~1,2s (o hero respira primeiro) e publica a própria altura em --cookie-h
 * pra barra de CTA e o botão flutuante ficarem sempre acima dele.
 */
export function CookieConsent() {
  const [visivel, setVisivel] = useState(false);
  const cartaoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ja = false;
    try {
      ja = !!localStorage.getItem(CHAVE_LOCALSTORAGE);
    } catch {
      // localStorage indisponível (navegador privado, etc.) — mostra mesmo
      // assim, só não lembra a escolha na próxima visita.
    }
    if (ja) return;
    const t = setTimeout(() => setVisivel(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const raiz = document.documentElement;
    const el = cartaoRef.current;
    if (!visivel || !el) {
      raiz.style.setProperty("--cookie-h", "0px");
      return;
    }
    const publicar = () => {
      const topo = el.getBoundingClientRect().top;
      raiz.style.setProperty(
        "--cookie-h",
        `${Math.max(0, Math.ceil(window.innerHeight - topo))}px`,
      );
    };
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    window.addEventListener("resize", publicar);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publicar);
      raiz.style.setProperty("--cookie-h", "0px");
    };
  }, [visivel]);

  function aceitar() {
    try {
      localStorage.setItem(CHAVE_LOCALSTORAGE, "aceito");
    } catch {
      // segue sem lembrar, sem quebrar o clique.
    }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      ref={cartaoRef}
      role="region"
      aria-label="Aviso de cookies"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-2xl border border-border bg-card/95 py-2.5 pr-2.5 pl-4 shadow-xl shadow-[oklch(0.25_0.03_156/0.18)] backdrop-blur-md sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm"
    >
      <p className="text-xs leading-snug text-foreground/80">
        Usamos cookies para melhorar sua experiência e medir anúncios.{" "}
        <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">
          Política de privacidade
        </Link>
      </p>
      <Button size="sm" onClick={aceitar} className="shrink-0 touch-manipulation">
        OK
      </Button>
    </div>
  );
}
