import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

const CHAVE_LOCALSTORAGE = "safralume_cookie_consent";

/**
 * Aviso de cookies (LGPD) — pendente desde que o Meta Pixel entrou no ar
 * (2026-09-04), nunca construído até agora. Só informativo: avisa e linka
 * pra /privacidade, não bloqueia o Pixel de disparar (gating de verdade
 * pausaria a atribuição real que os anúncios já dependem hoje — mudança
 * maior, fora do escopo deste aviso).
 */
export function CookieConsent() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CHAVE_LOCALSTORAGE)) setVisivel(true);
    } catch {
      // localStorage indisponível (navegador privado, etc.) — mostra mesmo
      // assim, só não lembra a escolha na próxima visita.
      setVisivel(true);
    }
  }, []);

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
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Usamos cookies pra melhorar sua experiência e medir o desempenho dos nossos anúncios. Veja
          como em nossa{" "}
          <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">
            política de privacidade
          </Link>
          .
        </p>
        <Button size="sm" onClick={aceitar} className="shrink-0">
          Entendi
        </Button>
      </div>
    </div>
  );
}
