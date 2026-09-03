import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LifeBuoy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { abrirTicket } from "@/lib/tickets.server";

export const Route = createFileRoute("/dashboard/_layout/suporte")({
  component: SuportePage,
});

type Ticket = {
  id: string;
  assunto: string;
  mensagem: string;
  resposta: string | null;
  status: string;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  aberto: "Aberto",
  respondido: "Respondido",
  fechado: "Fechado",
};

function SuportePage() {
  const { produtor, cooperativa, session } = useAuth();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function load() {
    if (!supabase) return;
    const query = supabase
      .from("tickets_suporte")
      .select("id, assunto, mensagem, resposta, status, created_at")
      .order("created_at", { ascending: false });
    const { data } = produtor
      ? await query.eq("produtor_id", produtor.id)
      : cooperativa
        ? await query.eq("cooperativa_id", cooperativa.id)
        : { data: [] };
    setTickets(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, cooperativa]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setEnviando(true);
    try {
      await abrirTicket({
        data: { accessToken: session.access_token, assunto, mensagem },
      });
      toast.success(
        "Chamado enviado! A gente responde pelo WhatsApp ou e-mail assim que possível.",
      );
      setAssunto("");
      setMensagem("");
      load();
    } catch {
      toast.error("Não foi possível enviar o chamado. Tenta de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={LifeBuoy}
        title="Suporte"
        description="Alguma dúvida ou problema? Manda pra gente aqui."
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-assunto">Assunto</Label>
              <Input
                id="s-assunto"
                required
                maxLength={200}
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex: preço não está atualizando"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-mensagem">Mensagem</Label>
              <Textarea
                id="s-mensagem"
                required
                maxLength={4000}
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Descreve o que está acontecendo, com o máximo de detalhe que puder."
              />
            </div>
            <Button type="submit" disabled={enviando} className="mt-1 w-fit">
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Send className="size-4" />
                  Enviar chamado
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-sm font-semibold text-foreground">Seus chamados</p>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {tickets === null ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="Nenhum chamado ainda"
              description="Quando você mandar uma mensagem pra gente, ela aparece aqui."
            />
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{t.assunto}</span>
                  <Badge variant="outline">{statusLabel[t.status] ?? t.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t.mensagem}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {t.resposta && (
                  <div className="mt-2 rounded-md bg-muted p-2.5">
                    <p className="text-xs font-medium text-foreground">Resposta do Safralume</p>
                    <p className="mt-0.5 text-sm text-foreground">{t.resposta}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
