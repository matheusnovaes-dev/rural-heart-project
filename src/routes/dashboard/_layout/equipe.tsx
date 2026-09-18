import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, UsersRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { useAuth, useRequireCooperativa } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const Route = createFileRoute("/dashboard/_layout/equipe")({
  component: EquipePage,
});

type Membro = {
  user_id: string;
  papel: "admin" | "membro";
  nome: string | null;
  email: string | null;
};

function EquipePage() {
  const { session } = useAuth();
  const cooperativa = useRequireCooperativa();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [copied, setCopied] = useState(false);

  function carregarMembros() {
    if (!supabase || !cooperativa) return;
    supabase
      .from("cooperativa_membros")
      .select("user_id, papel, nome, email")
      .eq("cooperativa_id", cooperativa.id)
      .then(({ data }) => setMembros(data ?? []));
  }

  useEffect(carregarMembros, [cooperativa]);

  if (!cooperativa) return null;

  const totalAdmins = membros.filter((m) => m.papel === "admin").length;

  async function handleRemover(userId: string) {
    if (!supabase || !cooperativa) return;
    const { error } = await supabase
      .from("cooperativa_membros")
      .delete()
      .eq("cooperativa_id", cooperativa.id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Não foi possível remover esse membro.");
      return;
    }
    toast.success("Membro removido da equipe.");
    carregarMembros();
  }

  const inviteLink = cooperativa
    ? `${window.location.origin}/onboarding?equipe=${cooperativa.id}`
    : "";

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link de convite copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={UsersRound}
        title="Equipe"
        description="Quem tem acesso ao painel da sua cooperativa"
      />
      <Card>
        <CardHeader>
          <CardTitle>Convidar pra equipe</CardTitle>
          <CardDescription>
            Compartilhe esse link com quem deve ter acesso ao painel da cooperativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            readOnly
            aria-label="Link de convite"
            value={inviteLink}
            className="font-mono text-xs"
          />
          <Button variant="outline" onClick={copyLink} aria-label="Copiar link de convite">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membros da equipe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {membros.map((m) => {
            const ehUltimoAdmin = m.papel === "admin" && totalAdmins <= 1;
            const nomeExibido =
              m.nome ?? m.email ?? (
                <span className="font-mono text-xs text-muted-foreground">{m.user_id}</span>
              );
            return (
              <div
                key={m.user_id}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <span className="text-foreground">
                  {nomeExibido}
                  {m.user_id === session?.user.id && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={m.papel === "admin" ? "default" : "secondary"}>{m.papel}</Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={ehUltimoAdmin}
                        aria-label={`Remover ${m.nome ?? "membro"}`}
                        title={ehUltimoAdmin ? "Precisa de pelo menos 1 admin na equipe" : undefined}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover {m.nome ?? "esse membro"} da equipe?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa pessoa perde acesso ao painel da cooperativa na hora. O link de
                          convite continua o mesmo de sempre, então ela consegue entrar de novo se
                          usar esse link outra vez.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemover(m.user_id)}>
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
