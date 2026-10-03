import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gavel, Loader2, MapPin, Plus, Radio, Trash2, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { limiteAlertas, temAcessoPrata, useAssinatura, type Plano } from "@/lib/planos";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";

export const Route = createFileRoute("/dashboard/_layout/leiloes")({
  component: LeiloesPage,
});

type Leilao = {
  id: string;
  titulo: string;
  data_hora: string | null;
  municipio: string | null;
  uf: string | null;
  leiloeira: string | null;
  oferta: string | null;
  url: string;
};

type AlertaLeilao = {
  id: string;
  uf: string | null;
  tipo_preferido: "presencial" | "virtual" | "qualquer";
  ativo: boolean;
  produtor_id: string;
};

const tipoLabel: Record<AlertaLeilao["tipo_preferido"], string> = {
  presencial: "Só presencial",
  virtual: "Só virtual",
  qualquer: "Qualquer tipo",
};

function formatarDataHora(iso: string | null) {
  if (!iso) return "Data a confirmar";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LeiloesPage() {
  const { produtor } = useAuth();
  const { plano, assinaturaId, asaasSubscriptionId } = useAssinatura();
  const temAcesso = temAcessoPrata(plano);

  const [presenciais, setPresenciais] = useState<Leilao[]>([]);
  const [virtuais, setVirtuais] = useState<Leilao[]>([]);
  const [alertas, setAlertas] = useState<AlertaLeilao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!supabase || !produtor || !temAcesso) {
      setCarregando(false);
      return;
    }
    const agora = new Date().toISOString();
    const { data: todos } = await supabase
      .from("leiloes_agendados")
      .select("id, titulo, data_hora, municipio, uf, leiloeira, oferta, url")
      .gte("data_hora", agora)
      .order("data_hora", { ascending: true })
      .limit(100);

    const ehVirtual = (l: Leilao) => (l.municipio ?? "").toUpperCase().startsWith("VIRTUAL");
    const lista = todos ?? [];
    setPresenciais(lista.filter((l) => l.uf === produtor.uf && !ehVirtual(l)));
    setVirtuais(lista.filter(ehVirtual));

    const { data: dataAlertas } = await supabase
      .from("alertas_leilao")
      .select("id, uf, tipo_preferido, ativo, produtor_id")
      .eq("produtor_id", produtor.id)
      .order("created_at", { ascending: false });
    setAlertas(dataAlertas ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, temAcesso]);

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  async function cancelar(id: string) {
    if (!supabase) return;
    setCancelandoId(id);
    const { error } = await supabase.from("alertas_leilao").update({ ativo: false }).eq("id", id);
    setCancelandoId(null);
    if (error) {
      toast.error("Não foi possível cancelar o alerta.");
      return;
    }
    toast.success("Alerta cancelado.");
    load();
  }

  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  async function excluir(id: string) {
    if (!supabase) return;
    setExcluindoId(id);
    const { error } = await supabase.from("alertas_leilao").delete().eq("id", id);
    setExcluindoId(null);
    if (error) {
      toast.error("Não foi possível excluir o alerta.");
      return;
    }
    toast.success("Alerta excluído.");
    load();
  }

  const alertasAtivos = alertas.filter((a) => a.ativo).length;
  const limite = limiteAlertas(plano);
  const atingiuLimite = alertasAtivos >= limite;
  const planoAlvo: Plano = "prata";

  if (!temAcesso) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          icon={Gavel}
          title="Leilões"
          description="Agenda de leilão de gado (presencial e virtual) no Brasil inteiro."
        />
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Gavel}
              title="Exclusivo do plano Prata"
              description="Acompanhe leilão de gado presencial na sua região e leilão virtual em destaque no Brasil inteiro, com alerta automático quando entrar leilão novo na agenda."
              action={
                <UpgradeButton
                  planoAlvo={planoAlvo}
                  assinaturaId={assinaturaId}
                  asaasSubscriptionId={asaasSubscriptionId}
                />
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Gavel}
        title="Leilões"
        description="Agenda de leilão de gado — presencial na sua região e virtual em destaque."
        action={
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              {!atingiuLimite && (
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="size-4" />
                    Novo alerta de leilão
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo alerta de leilão</DialogTitle>
                </DialogHeader>
                <AlertaLeilaoForm
                  produtorId={produtor?.id ?? ""}
                  whatsappDestino={produtor?.whatsapp ?? ""}
                  ufPadrao={produtor?.uf ?? ""}
                  onDone={() => {
                    setOpen(false);
                    load();
                  }}
                />
              </DialogContent>
            </Dialog>
            {atingiuLimite && (
              <UpgradeButton
                planoAlvo="ouro"
                assinaturaId={assinaturaId}
                asaasSubscriptionId={asaasSubscriptionId}
              />
            )}
          </div>
        }
      />

      {alertas.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <p className="text-sm font-semibold text-foreground">Seus alertas</p>
            {alertas.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-foreground">
                  {a.uf ? `${a.uf} · ` : "Brasil inteiro · "}
                  {tipoLabel[a.tipo_preferido]}
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant={a.ativo ? "secondary" : "outline"} className="mr-1 text-[11px]">
                    {a.ativo ? "Ativo" : "Cancelado"}
                  </Badge>
                  {a.ativo && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-muted-foreground hover:text-foreground"
                      disabled={cancelandoId === a.id}
                      title="Cancelar"
                      onClick={() => cancelar(a.id)}
                    >
                      {cancelandoId === a.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-8 p-0 text-muted-foreground hover:text-destructive"
                        disabled={excluindoId === a.id}
                        title="Excluir"
                      >
                        {excluindoId === a.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir esse alerta de leilão?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => excluir(a.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-sm font-semibold text-foreground">Presenciais na sua região</p>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {carregando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : presenciais.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Nenhum leilão presencial agendado na sua região"
              description="Assim que entrar um leilão novo na UF cadastrada, ele aparece aqui."
            />
          ) : (
            presenciais.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{l.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.municipio} · {l.leiloeira}
                    </span>
                    {l.oferta && (
                      <span className="mt-0.5 text-xs text-foreground/80">{l.oferta}</span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-[11px] tabular-nums">
                  {formatarDataHora(l.data_hora)}
                </Badge>
              </a>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-sm font-semibold text-foreground">Virtuais em destaque</p>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {carregando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : virtuais.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="Nenhum leilão virtual em destaque agora"
              description="Transmissão online, nacional — qualquer um pode assistir e dar lance."
            />
          ) : (
            virtuais.slice(0, 10).map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Radio className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{l.titulo}</span>
                    <span className="text-xs text-muted-foreground">{l.leiloeira}</span>
                    {l.oferta && (
                      <span className="mt-0.5 text-xs text-foreground/80">{l.oferta}</span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-[11px] tabular-nums">
                  {formatarDataHora(l.data_hora)}
                </Badge>
              </a>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertaLeilaoForm({
  produtorId,
  whatsappDestino,
  ufPadrao,
  onDone,
}: {
  produtorId: string;
  whatsappDestino: string;
  ufPadrao: string;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const [tipoPreferido, setTipoPreferido] = useState<AlertaLeilao["tipo_preferido"]>("qualquer");
  const [uf, setUf] = useState(ufPadrao);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !produtorId) return;
    setLoading(true);
    const { error } = await supabase.from("alertas_leilao").insert({
      produtor_id: produtorId,
      criado_por: session.user.id,
      uf: tipoPreferido === "virtual" ? null : uf.toUpperCase() || null,
      tipo_preferido: tipoPreferido,
      whatsapp_destino: whatsappDestino,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar o alerta.");
      return;
    }
    toast.success("Alerta criado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <Select
          value={tipoPreferido}
          onValueChange={(v) => setTipoPreferido(v as AlertaLeilao["tipo_preferido"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer tipo</SelectItem>
            <SelectItem value="presencial">Só presencial (na minha UF)</SelectItem>
            <SelectItem value="virtual">Só virtual (Brasil inteiro)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {tipoPreferido !== "virtual" && (
        <div className="space-y-1.5">
          <Label htmlFor="al-uf">UF</Label>
          <Input
            id="al-uf"
            required
            maxLength={2}
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
          />
        </div>
      )}
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Criar alerta"}
      </Button>
    </form>
  );
}
