import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { definirAcessoConta } from "@/lib/conta.server";

/** Conta técnica criada pelo formulário da landing (ver conta.server.ts). */
export function ehContaTecnica(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith("@safralume.app");
}

/**
 * Convite pra quem se cadastrou pelo formulário rápido e ainda não tem e-mail
 * e senha de verdade: sem isso, ele só entra no painel no navegador em que
 * se cadastrou, e não tem como recuperar o acesso.
 */
export function CompletarAcessoCard() {
  const { session, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [erro, setErro] = useState("");

  if (!session || !ehContaTecnica(session.user.email)) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !supabase) return;
    setStatus("loading");
    setErro("");
    try {
      const { email: emailSalvo } = await definirAcessoConta({
        data: { accessToken: session.access_token, email, senha },
      });
      // A troca de e-mail/senha foi feita direto no servidor: o navegador
      // ainda guarda a sessão da conta técnica. Entra de novo com as
      // credenciais novas pra ter a sessão certa e o cartão sumir na hora.
      const { error: erroLogin } = await supabase.auth.signInWithPassword({
        email: emailSalvo,
        password: senha,
      });
      if (erroLogin)
        throw new Error("Acesso salvo, mas não conseguimos entrar agora. Recarregue a página.");
      await refresh();
      toast.success(`Pronto! Agora você entra com ${emailSalvo} e a senha que criou.`);
    } catch (err) {
      setStatus("error");
      setErro(err instanceof Error ? err.message : "Não foi possível salvar agora. Tente de novo.");
    }
  }

  return (
    <form
      onSubmit={salvar}
      className="flex flex-col gap-3 rounded-lg border border-gold/40 bg-gold-soft/40 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-foreground">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Crie seu e-mail e senha de acesso</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Hoje você só entra neste painel no aparelho em que se cadastrou. Cadastre um e-mail e
            uma senha pra voltar de qualquer lugar.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="acesso-email" className="text-xs">
            Seu e-mail
          </Label>
          <Input
            id="acesso-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acesso-senha" className="text-xs">
            Crie uma senha
          </Label>
          <div className="relative">
            <Input
              id="acesso-senha"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {status === "error" && <p className="text-xs text-destructive">{erro}</p>}

      <div>
        <Button type="submit" size="sm" disabled={status === "loading"}>
          {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Salvar acesso"}
        </Button>
      </div>
    </form>
  );
}
