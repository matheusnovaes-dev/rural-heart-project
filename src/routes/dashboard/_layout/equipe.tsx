import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useRequireCooperativa } from "@/lib/auth";

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
  const cooperativa = useRequireCooperativa();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabase || !cooperativa) return;
    supabase
      .from("cooperativa_membros")
      .select("user_id, papel, nome, email")
      .eq("cooperativa_id", cooperativa.id)
      .then(({ data }) => setMembros(data ?? []));
  }, [cooperativa]);

  if (!cooperativa) return null;

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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Convidar pra equipe</CardTitle>
          <CardDescription>
            Compartilhe esse link com quem deve ter acesso ao painel da cooperativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input readOnly value={inviteLink} className="font-mono text-xs" />
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membros da equipe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {membros.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
            >
              <span className="text-foreground">
                {m.nome ?? m.email ?? (
                  <span className="font-mono text-xs text-muted-foreground">{m.user_id}</span>
                )}
              </span>
              <Badge variant={m.papel === "admin" ? "default" : "secondary"}>{m.papel}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
