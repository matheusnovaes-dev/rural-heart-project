import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "enviado" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setStatus("loading");

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    // Sempre mostra a mesma mensagem de sucesso, exista ou não conta com
    // esse e-mail — evita que alguém use esse formulário pra descobrir
    // quais e-mails têm conta no Safralume.
    setStatus("enviado");
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="text-muted-foreground">Área logada indisponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            {siteConfig.name}
          </span>
        </Link>

        {status === "enviado" ? (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">Verifique seu e-mail</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Se houver uma conta com o e-mail <strong>{email}</strong>, mandamos um link pra
              redefinir a senha.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-sm text-muted-foreground hover:underline"
            >
              Voltar pro login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-center text-xl font-semibold text-foreground">Recuperar senha</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Digite seu e-mail e mandamos um link pra você criar uma senha nova.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Button type="submit" size="lg" disabled={status === "loading"} className="mt-1">
                {status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>

            <Link
              to="/login"
              className="mt-4 block w-full text-center text-sm text-muted-foreground hover:underline"
            >
              Voltar pro login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
