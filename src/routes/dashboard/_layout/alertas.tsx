import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  TrendingUp,
  Loader2,
  Plus,
  ArrowDown,
  ArrowUp,
  Pencil,
  Trash2,
  X,
  CloudRain,
} from "lucide-react";

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
import { limiteAlertas, useAssinatura, type Plano } from "@/lib/planos";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";

export const Route = createFileRoute("/dashboard/_layout/alertas")({
  component: AlertasPage,
});

type Alerta = {
  id: string;
  cultura: string;
  uf: string;
  limite: number;
  direcao: "acima" | "abaixo";
  ativo: boolean;
  disparado_em: string | null;
  produtor_id: string;
  whatsapp_destino: string;
};

type CondicaoClima = "chuva_forte" | "geada" | "seca_prolongada" | "vento_forte";

type AlertaClima = {
  id: string;
  uf: string;
  condicao: CondicaoClima;
  limite: number;
  ativo: boolean;
  ultimo_disparo_data: string | null;
  produtor_id: string;
  whatsapp_destino: string;
};

const condicaoInfo: Record<
  CondicaoClima,
  { label: string; unidade: string; limitePadrao: number }
> = {
  chuva_forte: { label: "Chuva forte", unidade: "% de probabilidade", limitePadrao: 70 },
  geada: { label: "Geada", unidade: "°C de mínima", limitePadrao: 3 },
  seca_prolongada: {
    label: "Seca prolongada (7 dias)",
    unidade: "% de probabilidade",
    limitePadrao: 20,
  },
  vento_forte: { label: "Vento forte", unidade: "km/h de rajada", limitePadrao: 40 },
};

function descreverCondicaoClima(a: AlertaClima) {
  const info = condicaoInfo[a.condicao];
  if (a.condicao === "seca_prolongada") {
    return `${a.uf} · sem previsão de chuva relevante (abaixo de ${a.limite}%) nos próximos 7 dias`;
  }
  if (a.condicao === "geada") {
    return `${a.uf} · mínima prevista abaixo de ${a.limite}°C`;
  }
  if (a.condicao === "vento_forte") {
    return `${a.uf} · rajada prevista acima de ${a.limite} km/h`;
  }
  return `${a.uf} · probabilidade de chuva acima de ${a.limite}% (${info.unidade})`;
}

function AlertasPage() {
  const { produtor, cooperativa } = useAuth();
  const { plano, assinaturaId, asaasSubscriptionId } = useAssinatura();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasClima, setAlertasClima] = useState<AlertaClima[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoresOpcoes, setProdutoresOpcoes] = useState<
    {
      id: string;
      nome: string;
      whatsapp: string;
      cultura_principal: string | null;
      uf: string | null;
    }[]
  >([]);
  const [funcionarios, setFuncionarios] = useState<
    { id: string; nome: string; whatsapp: string }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Alerta | null>(null);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("alertas_preco")
      .select(
        "id, cultura, uf, limite, direcao, ativo, disparado_em, produtor_id, whatsapp_destino",
      )
      .order("created_at", { ascending: false });
    setAlertas(data ?? []);

    const { data: dataClima } = await supabase
      .from("alertas_clima")
      .select("id, uf, condicao, limite, ativo, ultimo_disparo_data, produtor_id, whatsapp_destino")
      .order("created_at", { ascending: false });
    setAlertasClima(dataClima ?? []);
    setCarregando(false);

    if (cooperativa) {
      const { data: prods } = await supabase
        .from("produtores")
        .select("id, nome, whatsapp, cultura_principal, uf")
        .eq("cooperativa_id", cooperativa.id);
      setProdutoresOpcoes(prods ?? []);
    }

    if (produtor) {
      const { data: func } = await supabase
        .from("funcionarios")
        .select("id, nome, whatsapp")
        .eq("produtor_id", produtor.id)
        .order("nome");
      setFuncionarios(func ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, cooperativa]);

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function cancelar(id: string) {
    if (!supabase) return;
    setCancelandoId(id);
    const { error } = await supabase.from("alertas_preco").update({ ativo: false }).eq("id", id);
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
    const { error } = await supabase.from("alertas_preco").delete().eq("id", id);
    setExcluindoId(null);
    if (error) {
      toast.error("Não foi possível excluir o alerta.");
      return;
    }
    toast.success("Alerta excluído.");
    load();
  }

  const [cancelandoClimaId, setCancelandoClimaId] = useState<string | null>(null);

  async function cancelarClima(id: string) {
    if (!supabase) return;
    setCancelandoClimaId(id);
    const { error } = await supabase.from("alertas_clima").update({ ativo: false }).eq("id", id);
    setCancelandoClimaId(null);
    if (error) {
      toast.error("Não foi possível cancelar o alerta.");
      return;
    }
    toast.success("Alerta cancelado.");
    load();
  }

  const [excluindoClimaId, setExcluindoClimaId] = useState<string | null>(null);

  async function excluirClima(id: string) {
    if (!supabase) return;
    setExcluindoClimaId(id);
    const { error } = await supabase.from("alertas_clima").delete().eq("id", id);
    setExcluindoClimaId(null);
    if (error) {
      toast.error("Não foi possível excluir o alerta.");
      return;
    }
    toast.success("Alerta excluído.");
    load();
  }

  // produtorId é sempre o dono real da conta (pra RLS/histórico) — pode ser
  // diferente de quem recebe a mensagem, quando o destino é um funcionário
  // (que não tem linha própria em `produtores`). Mesmo padrão já usado em
  // lembretes.tsx. Uma conta pode ter os dois papéis ao mesmo tempo (admin
  // de cooperativa que também tem cadastro próprio de produtor) — por isso
  // as duas listas se somam em vez de uma excluir a outra; senão os
  // produtores da cooperativa somem da lista sempre que a conta também for
  // produtor (bug real, achado testando).
  const destinatarios: {
    id: string;
    nome: string;
    whatsapp: string;
    cultura_principal: string | null;
    uf: string | null;
    produtorId: string;
  }[] = [
    ...(produtor
      ? [
          {
            id: produtor.id,
            nome: "Você mesmo",
            whatsapp: produtor.whatsapp,
            cultura_principal: produtor.cultura_principal,
            uf: produtor.uf,
            produtorId: produtor.id,
          },
          ...funcionarios.map((f) => ({
            ...f,
            cultura_principal: produtor.cultura_principal,
            uf: produtor.uf,
            produtorId: produtor.id,
          })),
        ]
      : []),
    ...produtoresOpcoes
      .filter((p) => p.id !== produtor?.id)
      .map((p) => ({ ...p, produtorId: p.id })),
  ];

  const [openClima, setOpenClima] = useState(false);
  const [editandoClima, setEditandoClima] = useState<AlertaClima | null>(null);

  // Preço + clima somados contam pro mesmo teto — editar um alerta já
  // existente continua liberado mesmo no teto (só criar um novo é que fica
  // bloqueado), por isso o Dialog em si nunca some, só o botão de criar.
  const alertasAtivos =
    alertas.filter((a) => a.ativo).length + alertasClima.filter((a) => a.ativo).length;
  const limite = limiteAlertas(plano);
  const atingiuLimite = alertasAtivos >= limite;
  const planoAlvo: Plano = "prata";

  const dialogNovo = (
    <Dialog
      open={open || !!editando}
      onOpenChange={(v) => {
        if (!v) {
          setOpen(false);
          setEditando(null);
        }
      }}
    >
      {!atingiuLimite && (
        <DialogTrigger asChild>
          <Button size="sm" disabled={destinatarios.length === 0} onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Novo alerta de preço
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar alerta de preço" : "Novo alerta de preço"}</DialogTitle>
        </DialogHeader>
        <AlertaForm
          destinatarios={destinatarios}
          alerta={editando}
          onDone={() => {
            setOpen(false);
            setEditando(null);
            load();
          }}
        />
      </DialogContent>
    </Dialog>
  );

  const dialogNovoClima = (
    <Dialog
      open={openClima || !!editandoClima}
      onOpenChange={(v) => {
        if (!v) {
          setOpenClima(false);
          setEditandoClima(null);
        }
      }}
    >
      {!atingiuLimite && (
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={destinatarios.length === 0}
            onClick={() => setOpenClima(true)}
          >
            <Plus className="size-4" />
            Novo alerta de clima
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editandoClima ? "Editar alerta de clima" : "Novo alerta de clima"}
          </DialogTitle>
        </DialogHeader>
        <AlertaClimaForm
          destinatarios={destinatarios}
          alerta={editandoClima}
          onDone={() => {
            setOpenClima(false);
            setEditandoClima(null);
            load();
          }}
        />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={TrendingUp}
        title="Alertas"
        description="Preço e clima — só avisa quando tiver algo relevante pra você decidir."
        action={
          <div className="flex gap-2">
            {dialogNovoClima}
            {dialogNovo}
            {atingiuLimite && (
              <UpgradeButton
                planoAlvo={planoAlvo}
                assinaturaId={assinaturaId}
                asaasSubscriptionId={asaasSubscriptionId}
              />
            )}
          </div>
        }
      />
      {atingiuLimite && (
        <p className="text-sm text-muted-foreground">
          Você já usou os {limite} alertas do plano atual. Pra criar mais, é só fazer upgrade —
          editar ou cancelar os que já existem continua liberado.
        </p>
      )}
      <p className="text-sm font-semibold text-foreground">Alertas de preço</p>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {carregando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              {alertas.length === 0 && (
                <EmptyState
                  icon={TrendingUp}
                  title="Nenhum alerta ainda"
                  description="Crie um alerta pra ser avisado assim que a saca passar (ou cair abaixo) do valor que te interessa."
                />
              )}
              {alertas.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2 text-sm">
                    {a.direcao === "acima" ? (
                      <ArrowUp className="size-4 text-primary" />
                    ) : (
                      <ArrowDown className="size-4 text-destructive" />
                    )}
                    <span className="font-medium text-foreground">
                      {a.cultura} · {a.uf} {a.direcao} de{" "}
                      <span className="font-mono tabular-nums">
                        R${a.limite.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={a.disparado_em ? "default" : "secondary"}
                      className="mr-1 font-mono text-[11px] tabular-nums"
                    >
                      {a.disparado_em
                        ? `Disparado em ${new Date(a.disparado_em).toLocaleDateString("pt-BR")}`
                        : a.ativo
                          ? "Ativo, aguardando"
                          : "Cancelado"}
                    </Badge>
                    {a.ativo && !a.disparado_em && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Editar alerta ${a.cultura} ${a.uf}`}
                          onClick={() => setEditando(a)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={cancelandoId === a.id}
                          title="Cancelar (mantém no histórico)"
                          aria-label={`Cancelar alerta ${a.cultura} ${a.uf}`}
                          onClick={() => cancelar(a.id)}
                        >
                          {cancelandoId === a.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={excluindoId === a.id}
                          title="Excluir (remove do histórico)"
                          aria-label={`Excluir alerta ${a.cultura} ${a.uf}`}
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
                          <AlertDialogTitle>
                            Excluir alerta de {a.cultura} · {a.uf}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita — diferente de cancelar, remove o alerta
                            do histórico por completo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluir(a.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-sm font-semibold text-foreground">Alertas de clima</p>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {carregando ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              {alertasClima.length === 0 && (
                <EmptyState
                  icon={CloudRain}
                  title="Nenhum alerta de clima ainda"
                  description="Avisa automaticamente só quando tiver chuva forte, geada, seca prolongada ou vento forte previsto — não manda mensagem à toa."
                />
              )}
              {alertasClima.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <CloudRain className="size-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {condicaoInfo[a.condicao].label} — {descreverCondicaoClima(a)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={a.ultimo_disparo_data ? "default" : "secondary"}
                      className="mr-1 font-mono text-[11px] tabular-nums"
                    >
                      {!a.ativo
                        ? "Cancelado"
                        : a.ultimo_disparo_data
                          ? `Último aviso em ${new Date(`${a.ultimo_disparo_data}T00:00:00`).toLocaleDateString("pt-BR")}`
                          : "Ativo, monitorando"}
                    </Badge>
                    {a.ativo && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Editar alerta de clima ${a.uf}`}
                          onClick={() => setEditandoClima(a)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={cancelandoClimaId === a.id}
                          title="Cancelar (mantém no histórico)"
                          aria-label={`Cancelar alerta de clima ${a.uf}`}
                          onClick={() => cancelarClima(a.id)}
                        >
                          {cancelandoClimaId === a.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={excluindoClimaId === a.id}
                          title="Excluir (remove do histórico)"
                          aria-label={`Excluir alerta de clima ${a.uf}`}
                        >
                          {excluindoClimaId === a.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Excluir alerta de {condicaoInfo[a.condicao].label} · {a.uf}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita — diferente de cancelar, remove o alerta
                            do histórico por completo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluirClima(a.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertaForm({
  destinatarios,
  alerta,
  onDone,
}: {
  destinatarios: {
    id: string;
    nome: string;
    whatsapp: string;
    cultura_principal: string | null;
    uf: string | null;
    produtorId: string;
  }[];
  alerta: Alerta | null;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const destinatarioInicial =
    destinatarios.find((d) => d.whatsapp === alerta?.whatsapp_destino)?.id ??
    destinatarios[0]?.id ??
    "";
  const [destinatarioId, setDestinatarioId] = useState(destinatarioInicial);
  const selecionado = destinatarios.find((d) => d.id === destinatarioId) ?? destinatarios[0];

  const [cultura, setCultura] = useState(
    alerta?.cultura ?? selecionado?.cultura_principal ?? "soja",
  );
  const [uf, setUf] = useState(alerta?.uf ?? selecionado?.uf ?? "");
  const [limite, setLimite] = useState(alerta ? String(alerta.limite).replace(".", ",") : "");
  const [direcao, setDirecao] = useState<"acima" | "abaixo">(alerta?.direcao ?? "acima");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !limite || !uf) return;
    const destinatario = destinatarios.find((d) => d.id === destinatarioId);
    if (!destinatario) return;

    setLoading(true);
    const payload = {
      produtor_id: destinatario.produtorId,
      cultura,
      uf: uf.toUpperCase(),
      limite: parseFloat(limite.replace(",", ".")),
      direcao,
      whatsapp_destino: destinatario.whatsapp,
    };
    const { error } = alerta
      ? await supabase.from("alertas_preco").update(payload).eq("id", alerta.id)
      : await supabase.from("alertas_preco").insert({ ...payload, criado_por: session.user.id });
    setLoading(false);
    if (error) {
      toast.error(
        alerta ? "Não foi possível salvar as alterações." : "Não foi possível criar o alerta.",
      );
      return;
    }
    toast.success(alerta ? "Alerta atualizado." : "Alerta criado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label>Para quem</Label>
        {destinatarios.length > 1 ? (
          <Select value={destinatarioId} onValueChange={setDestinatarioId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {destinatarios.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">
            {destinatarios[0]?.nome ?? "—"}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="a-cultura">Cultura</Label>
          <Input
            id="a-cultura"
            required
            value={cultura}
            onChange={(e) => setCultura(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-uf">UF</Label>
          <Input
            id="a-uf"
            required
            maxLength={2}
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Avisar quando o preço ficar</Label>
        <Select value={direcao} onValueChange={(v) => setDirecao(v as "acima" | "abaixo")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="acima">Acima de</SelectItem>
            <SelectItem value="abaixo">Abaixo de</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-limite">Valor (R$ por saca)</Label>
        <Input
          id="a-limite"
          required
          inputMode="decimal"
          placeholder="Ex: 130,00"
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : alerta ? (
          "Salvar alterações"
        ) : (
          "Criar alerta"
        )}
      </Button>
    </form>
  );
}

function AlertaClimaForm({
  destinatarios,
  alerta,
  onDone,
}: {
  destinatarios: {
    id: string;
    nome: string;
    whatsapp: string;
    cultura_principal: string | null;
    uf: string | null;
    produtorId: string;
  }[];
  alerta: AlertaClima | null;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const destinatarioInicial =
    destinatarios.find((d) => d.whatsapp === alerta?.whatsapp_destino)?.id ??
    destinatarios[0]?.id ??
    "";
  const [destinatarioId, setDestinatarioId] = useState(destinatarioInicial);
  const selecionado = destinatarios.find((d) => d.id === destinatarioId) ?? destinatarios[0];

  const [uf, setUf] = useState(alerta?.uf ?? selecionado?.uf ?? "");
  const [condicao, setCondicao] = useState<CondicaoClima>(alerta?.condicao ?? "chuva_forte");
  const [limite, setLimite] = useState(
    alerta ? String(alerta.limite) : String(condicaoInfo.chuva_forte.limitePadrao),
  );
  const [loading, setLoading] = useState(false);

  function trocarCondicao(nova: CondicaoClima) {
    setCondicao(nova);
    setLimite(String(condicaoInfo[nova].limitePadrao));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !limite || !uf) return;
    const destinatario = destinatarios.find((d) => d.id === destinatarioId);
    if (!destinatario) return;

    setLoading(true);
    const payload = {
      produtor_id: destinatario.produtorId,
      uf: uf.toUpperCase(),
      condicao,
      limite: parseFloat(limite.replace(",", ".")),
      whatsapp_destino: destinatario.whatsapp,
    };
    const { error } = alerta
      ? await supabase.from("alertas_clima").update(payload).eq("id", alerta.id)
      : await supabase.from("alertas_clima").insert({ ...payload, criado_por: session.user.id });
    setLoading(false);
    if (error) {
      toast.error(
        alerta ? "Não foi possível salvar as alterações." : "Não foi possível criar o alerta.",
      );
      return;
    }
    toast.success(alerta ? "Alerta atualizado." : "Alerta criado.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label>Para quem</Label>
        {destinatarios.length > 1 ? (
          <Select value={destinatarioId} onValueChange={setDestinatarioId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {destinatarios.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">
            {destinatarios[0]?.nome ?? "—"}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Condição</Label>
        <Select value={condicao} onValueChange={(v) => trocarCondicao(v as CondicaoClima)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(condicaoInfo) as CondicaoClima[]).map((c) => (
              <SelectItem key={c} value={c}>
                {condicaoInfo[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ac-uf">UF</Label>
          <Input
            id="ac-uf"
            required
            maxLength={2}
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ac-limite">Limite ({condicaoInfo[condicao].unidade})</Label>
          <Input
            id="ac-limite"
            required
            inputMode="decimal"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : alerta ? (
          "Salvar alterações"
        ) : (
          "Criar alerta"
        )}
      </Button>
    </form>
  );
}
