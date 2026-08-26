import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Sprout, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [senha, setSenha] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sucesso" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!supabase) return;
    // O link do e-mail já autentica o usuário numa sessão temporária de
    // recuperação (o supabase-js processa o token da URL sozinho); só
    // liberamos o formulário depois de confirmar que essa sessão existe.
    let resolvido = false;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolvido = true;
        setPronto(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        resolvido = true;
        setPronto(true);
      }
    });
    // Link ausente, inválido ou expirado nunca dispara sessão nem o evento
    // acima — sem isso a tela ficaria presa em "verificando" pra sempre.
    const semLinkValido = setTimeout(() => {
      if (!resolvido) setLinkInvalido(true);
    }, 4000);
    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(semLinkValido);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setStatus("loading");
    setErrorMsg("");

    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setStatus("error");
      setErrorMsg("Não foi possível trocar a senha. Tente pedir um novo link.");
      return;
    }

    setStatus("sucesso");
    setTimeout(() => navigate({ to: "/dashboard" }), 1500);
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

        {linkInvalido ? (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Esse link de recuperação não é mais válido. Peça um novo.
            </p>
            <Link
              to="/recuperar-senha"
              className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
            >
              Pedir novo link
            </Link>
          </div>
        ) : !pronto ? (
          <p className="text-center text-sm text-muted-foreground">
            Verificando o link de recuperação...
          </p>
        ) : status === "sucesso" ? (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">Senha alterada!</h1>
            <p className="mt-3 text-sm text-muted-foreground">Te levando pro painel...</p>
          </div>
        ) : (
          <>
            <h1 className="text-center text-xl font-semibold text-foreground">Nova senha</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Escolha uma nova senha pra sua conta.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="senha">Nova senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>

              {status === "error" && <p className="text-sm text-destructive">{errorMsg}</p>}

              <Button type="submit" size="lg" disabled={status === "loading"} className="mt-1">
                {status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
