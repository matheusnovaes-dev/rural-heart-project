import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageCircle, Sprout } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { buildWhatsAppLink, siteConfig } from "@/config/site";

const searchSchema = z.object({ t: z.string().optional() });

export const Route = createFileRoute("/acesso")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AcessoPage,
});

/**
 * Destino do link de acesso que o bot manda no WhatsApp (link de uso único).
 * O token só é gasto aqui, pelo navegador — pré-visualização de link e robôs
 * de mensagem não executam JavaScript, então não consomem o link.
 */
function AcessoPage() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<"entrando" | "erro">(t ? "entrando" : "erro");
  // Em desenvolvimento o React roda efeitos duas vezes; o link é de uso
  // único, então a segunda chamada falharia mesmo com a primeira certa.
  const jaTentou = useRef(false);

  useEffect(() => {
    if (!t || !supabase || jaTentou.current) return;
    jaTentou.current = true;
    supabase.auth
      .verifyOtp({ token_hash: t, type: "magiclink" })
      .then(async ({ error }) => {
        if (error) {
          setStatus("erro");
          return;
        }
        await refresh();
        navigate({ to: "/dashboard", replace: true });
      })
      .catch(() => setStatus("erro"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sprout className="size-5" />
        </span>
        <p className="mt-2 text-sm font-semibold text-foreground">{siteConfig.name}</p>

        {status === "entrando" ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Abrindo seu painel...</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground">Esse link não vale mais</h1>
            <p className="text-sm text-muted-foreground">
              O link de acesso é de uso único e vale por pouco tempo. Peça um novo pelo WhatsApp: é
              só mandar "quero acessar meu painel".
            </p>
            <Button asChild className="w-full bg-[#25D366] text-white hover:bg-[#25D366]/90">
              <a
                href={buildWhatsAppLink("Quero acessar meu painel")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" />
                Pedir novo link no WhatsApp
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
