import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingUp, Loader2, Plus, ArrowDown, ArrowUp, X, CloudRain } from "lucide-react";

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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
};

type CondicaoClima = "chuva_forte" | "geada" | "seca_prolongada" | "vento_forte";

type AlertaClima = {
  id: string;
  uf: string;
  condicao: CondicaoClima;
  limite: number;
  ativo: boolean;
  ultimo_disparo_data: string | null;
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

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("alertas_preco")
      .select("id, cultura, uf, limite, direcao, ativo, disparado_em")
      .order("created_at", { ascending: false });
    setAlertas(data ?? []);

    const { data: dataClima } = await supabase
      .from("alertas_clima")
      .select("id, uf, condicao, limite, ativo, ultimo_disparo_data")
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

  // produtorId é sempre o dono real da conta (pra RLS/histórico) — pode ser
  // diferente de quem recebe a mensagem, quando o destino é um funcionário
  // (que não tem linha própria em `produtores`). Mesmo padrão já usado em
  // lembretes.tsx.
  const destinatarios: {
    id: string;
    nome: string;
    whatsapp: string;
    cultura_principal: string | null;
    uf: string | null;
    produtorId: string;
  }[] = produtor
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
    : produtoresOpcoes.map((p) => ({ ...p, produtorId: p.id }));

  const [openClima, setOpenClima] = useState(false);

  const dialogNovo = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={destinatarios.length === 0}>
          <Plus className="size-4" />
          Novo alerta de preço
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo alerta de preço</DialogTitle>
        </DialogHeader>
        <NovoAlertaForm
          destinatarios={destinatarios}
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      </DialogContent>
    </Dialog>
  );

  const dialogNovoClima = (
    <Dialog open={openClima} onOpenChange={setOpenClima}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={destinatarios.length === 0}>
          <Plus className="size-4" />
          Novo alerta de clima
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo alerta de clima</DialogTitle>
        </DialogHeader>
        <NovoAlertaClimaForm
          destinatarios={destinatarios}
          onDone={() => {
            setOpenClima(false);
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
          </div>
        }
      />
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
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={a.disparado_em ? "default" : "secondary"}
                      className="font-mono text-[11px] tabular-nums"
                    >
                      {a.disparado_em
                        ? `Disparado em ${new Date(a.disparado_em).toLocaleDateString("pt-BR")}`
                        : a.ativo
                          ? "Ativo, aguardando"
                          : "Cancelado"}
                    </Badge>
                    {a.ativo && !a.disparado_em && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={cancelandoId === a.id}
                        onClick={() => cancelar(a.id)}
                      >
                        {cancelandoId === a.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <X className="size-4" />
                            Cancelar
                          </>
                        )}
                      </Button>
                    )}
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
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={a.ultimo_disparo_data ? "default" : "secondary"}
                      className="font-mono text-[11px] tabular-nums"
                    >
                      {!a.ativo
                        ? "Cancelado"
                        : a.ultimo_disparo_data
                          ? `Último aviso em ${new Date(`${a.ultimo_disparo_data}T00:00:00`).toLocaleDateString("pt-BR")}`
                          : "Ativo, monitorando"}
                    </Badge>
                    {a.ativo && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={cancelandoClimaId === a.id}
                        onClick={() => cancelarClima(a.id)}
                      >
                        {cancelandoClimaId === a.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <X className="size-4" />
                            Cancelar
                          </>
                        )}
                      </Button>
                    )}
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

function NovoAlertaForm({
  destinatarios,
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
  onDone: () => void;
}) {
  const { session } = useAuth();
  const [destinatarioId, setDestinatarioId] = useState(destinatarios[0]?.id ?? "");
  const selecionado = destinatarios.find((d) => d.id === destinatarioId) ?? destinatarios[0];

  const [cultura, setCultura] = useState(selecionado?.cultura_principal ?? "soja");
  const [uf, setUf] = useState(selecionado?.uf ?? "");
  const [limite, setLimite] = useState("");
  const [direcao, setDirecao] = useState<"acima" | "abaixo">("acima");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !limite || !uf) return;
    const destinatario = destinatarios.find((d) => d.id === destinatarioId);
    if (!destinatario) return;

    setLoading(true);
    const { error } = await supabase.from("alertas_preco").insert({
      produtor_id: destinatario.produtorId,
      criado_por: session.user.id,
      cultura,
      uf: uf.toUpperCase(),
      limite: parseFloat(limite.replace(",", ".")),
      direcao,
      whatsapp_destino: destinatario.whatsapp,
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
      {destinatarios.length > 1 && (
        <div className="space-y-1.5">
          <Label>Para quem</Label>
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
        </div>
      )}
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
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Criar alerta"}
      </Button>
    </form>
  );
}

function NovoAlertaClimaForm({
  destinatarios,
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
  onDone: () => void;
}) {
  const { session } = useAuth();
  const [destinatarioId, setDestinatarioId] = useState(destinatarios[0]?.id ?? "");
  const selecionado = destinatarios.find((d) => d.id === destinatarioId) ?? destinatarios[0];

  const [uf, setUf] = useState(selecionado?.uf ?? "");
  const [condicao, setCondicao] = useState<CondicaoClima>("chuva_forte");
  const [limite, setLimite] = useState(String(condicaoInfo.chuva_forte.limitePadrao));
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
    const { error } = await supabase.from("alertas_clima").insert({
      produtor_id: destinatario.produtorId,
      criado_por: session.user.id,
      uf: uf.toUpperCase(),
      condicao,
      limite: parseFloat(limite.replace(",", ".")),
      whatsapp_destino: destinatario.whatsapp,
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
      {destinatarios.length > 1 && (
        <div className="space-y-1.5">
          <Label>Para quem</Label>
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
        </div>
      )}
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
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Criar alerta"}
      </Button>
    </form>
  );
}
