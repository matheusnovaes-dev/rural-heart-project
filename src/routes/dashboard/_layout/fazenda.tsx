import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Sprout,
  StickyNote,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";

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
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { IconesSafralume } from "@/components/icons/SafralumeIcon";
import { supabase } from "@/lib/supabase";
import { useAuth, useRequireProdutor } from "@/lib/auth";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";
import { CustoMargemCard } from "@/components/fazenda/CustoMargemCard";
import { EstoqueBloqueado, EstoqueCard } from "@/components/fazenda/EstoqueCard";
import { PendenciasCard } from "@/components/fazenda/PendenciasCard";
import { PorTalhaoCard } from "@/components/fazenda/PorTalhaoCard";
import {
  cancelarLembrete,
  criarLembreteDoVencimento,
  darBaixaNoPainel,
} from "@/components/fazenda/acoes";
import { buildWhatsAppLink } from "@/config/site";
import {
  CATEGORIAS_GASTO,
  COLUNAS_REGISTRO,
  ROTULO_TIPO,
  TIPOS_REGISTRO,
  categoriaDeTexto,
  dataLonga,
  formatarQuantidade,
  formatarReais,
  hojeBrasilia,
  intervaloDoPeriodo,
  numerosDoTexto,
  resumir,
  somarDias,
  type PeriodoCaderno,
  type RegistroFazenda,
  type TipoRegistro,
} from "@/lib/fazenda.shared";

export const Route = createFileRoute("/dashboard/_layout/fazenda")({
  head: () => ({ meta: [{ title: "Caderno da fazenda | Safralume" }] }),
  component: FazendaPage,
});

const PERIODOS: { id: PeriodoCaderno; rotulo: string }[] = [
  { id: "mes", rotulo: "Este mês" },
  { id: "mes_passado", rotulo: "Mês passado" },
  { id: "safra", rotulo: "Safra" },
  { id: "ano", rotulo: "Ano" },
  { id: "tudo", rotulo: "Tudo" },
];

const ICONE_TIPO: Record<TipoRegistro, typeof Wallet> = {
  gasto: Wallet,
  venda: TrendingUp,
  plantio: Sprout,
  colheita: Wheat,
  nota: StickyNote,
  estoque: Warehouse,
};

const COR_TIPO: Record<TipoRegistro, string> = {
  gasto: "bg-amber-100 text-amber-900",
  venda: "bg-emerald-100 text-emerald-900",
  plantio: "bg-lime-100 text-lime-900",
  colheita: "bg-orange-100 text-orange-900",
  nota: "bg-slate-100 text-slate-700",
  estoque: "bg-sky-100 text-sky-900",
};

const EXEMPLOS = [
  "gastei 12 mil de adubo no talhão 3",
  "vendi 500 sacas de soja a 135",
  "plantei milho dia 15",
];

function rotuloDoDia(iso: string): string {
  const hoje = hojeBrasilia();
  if (iso === hoje) return "Hoje";
  if (iso === somarDias(hoje, -1)) return "Ontem";
  return dataLonga(iso);
}

function FazendaPage() {
  const produtor = useRequireProdutor();
  const [periodo, setPeriodo] = useState<PeriodoCaderno>("mes");
  const [registros, setRegistros] = useState<RegistroFazenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<TipoRegistro | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<RegistroFazenda | "novo" | null>(null);
  const [apagando, setApagando] = useState<RegistroFazenda | null>(null);
  const [temQualquerCoisa, setTemQualquerCoisa] = useState<boolean | null>(null);
  const [pendentes, setPendentes] = useState<RegistroFazenda[]>([]);
  const [versao, setVersao] = useState(0);
  const [tipoInicial, setTipoInicial] = useState<TipoRegistro>("gasto");
  const { plano, assinaturaId, asaasSubscriptionId } = useAssinatura();
  const temPrata = temAcessoPrata(plano);

  const carregar = useCallback(async () => {
    if (!supabase || !produtor) return;
    setCarregando(true);
    const { desde, ate } = intervaloDoPeriodo(periodo);
    const [principal, aPagarReceber] = await Promise.all([
      supabase
        .from("fazenda_registros")
        .select(COLUNAS_REGISTRO)
        .eq("produtor_id", produtor.id)
        .is("apagado_em", null)
        .eq("situacao", "realizado")
        .gte("ocorrido_em", desde)
        .lte("ocorrido_em", ate)
        .order("ocorrido_em", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(2000),
      supabase
        .from("fazenda_registros")
        .select(COLUNAS_REGISTRO)
        .eq("produtor_id", produtor.id)
        .is("apagado_em", null)
        .eq("situacao", "pendente")
        .order("vence_em", { ascending: true })
        .limit(500),
    ]);
    const { data, error } = principal;
    setErro(!!error);
    const lista = (data ?? []) as unknown as RegistroFazenda[];
    const doPendente = (aPagarReceber.data ?? []) as unknown as RegistroFazenda[];
    setRegistros(lista);
    setPendentes(doPendente);
    setVersao((v) => v + 1);
    if (lista.length > 0 || doPendente.length > 0) setTemQualquerCoisa(true);
    else if (periodo === "tudo" || temQualquerCoisa === null) {
      if (periodo === "tudo") setTemQualquerCoisa(false);
      else {
        const { count } = await supabase
          .from("fazenda_registros")
          .select("id", { count: "exact", head: true })
          .eq("produtor_id", produtor.id)
          .is("apagado_em", null)
          .neq("situacao", "rascunho");
        setTemQualquerCoisa((count ?? 0) > 0);
      }
    }
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtor, periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resumo = useMemo(() => resumir(registros), [registros]);
  const porMes = useMemo(() => {
    const m = new Map<string, { gasto: number; venda: number }>();
    for (const r of registros) {
      if (r.valor === null || (r.tipo !== "gasto" && r.tipo !== "venda")) continue;
      const k = r.ocorrido_em.slice(0, 7);
      const x = m.get(k) ?? { gasto: 0, venda: 0 };
      if (r.tipo === "gasto") x.gasto += r.valor;
      else x.venda += r.valor;
      m.set(k, x);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [registros]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return registros.filter(
      (r) =>
        (filtroTipo === "todos" || r.tipo === filtroTipo) &&
        (!q ||
          [r.descricao, r.categoria, r.cultura, r.talhao]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [registros, filtroTipo, busca]);

  const grupos = useMemo(() => {
    const g = new Map<string, RegistroFazenda[]>();
    for (const r of visiveis) g.set(r.ocorrido_em, [...(g.get(r.ocorrido_em) ?? []), r]);
    return [...g.entries()];
  }, [visiveis]);

  async function apagar(r: RegistroFazenda) {
    if (!supabase) return;
    const { error } = await supabase
      .from("fazenda_registros")
      .update({ apagado_em: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      toast.error("Não foi possível apagar o lançamento.");
      return;
    }
    await cancelarLembrete(supabase, r.lembrete_id);
    toast.success("Lançamento apagado.");
    setApagando(null);
    carregar();
  }

  async function darBaixa(r: RegistroFazenda) {
    if (!supabase) return;
    const ok = await darBaixaNoPainel(supabase, r);
    if (!ok) {
      toast.error("Não foi possível dar baixa agora.");
      return;
    }
    toast.success(r.tipo === "venda" ? "Recebimento anotado." : "Pagamento anotado.");
    carregar();
  }

  function baixarPlanilha() {
    const linhas = [
      [
        "Data",
        "Tipo",
        "Descrição",
        "Categoria",
        "Cultura",
        "Talhão",
        "Quantidade",
        "Unidade",
        "Preço unitário",
        "Valor",
      ],
      ...registros.map((r) => [
        r.ocorrido_em,
        ROTULO_TIPO[r.tipo],
        r.descricao,
        r.categoria ?? "",
        r.cultura ?? "",
        r.talhao ?? "",
        r.quantidade === null ? "" : String(r.quantidade).replace(".", ","),
        r.unidade ?? "",
        r.preco_unitario === null ? "" : String(r.preco_unitario).replace(".", ","),
        r.valor === null ? "" : String(r.valor).replace(".", ","),
      ]),
    ];
    const csv = linhas
      .map((l) =>
        l
          .map(
            (c) =>
              `"${String(c)
                .replace(/"/g, '""')
                .replace(/^([=+@-])/, "'$1")}"`,
          )
          .join(";"),
      )
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caderno-da-fazenda-${hojeBrasilia()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!produtor) return null;

  const maiorMes = Math.max(1, ...porMes.map(([, v]) => Math.max(v.gasto, v.venda)));
  const maiorCategoria = Math.max(1, ...resumo.porCategoria.map((c) => c.total));
  const vazioGeral = temQualquerCoisa === false && !carregando;
  const culturasSugeridas = [
    ...new Set(
      [produtor.cultura_principal, ...registros.map((r) => r.cultura)]
        .filter((c): c is string => !!c)
        .map((c) => c.toLowerCase()),
    ),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={IconesSafralume.safra}
        iconePersonalizado
        title="Caderno da fazenda"
        description="Gastos, vendas, plantio e colheita num lugar só. Lance aqui ou escrevendo no WhatsApp."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a
                href={buildWhatsAppLink("Gastei 3 mil de diesel hoje")}
                target="_blank"
                rel="noreferrer noopener"
              >
                <MessageCircle className="size-4" />
                Lançar pelo WhatsApp
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/dashboard/relatorio-fazenda" search={{ periodo }}>
                <FileText className="size-4" />
                Relatório (PDF)
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTipoInicial("gasto");
                setEditando("novo");
              }}
            >
              <Plus className="size-4" />
              Novo lançamento
            </Button>
          </div>
        }
      />

      {vazioGeral ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Sprout}
              title="Seu caderno ainda está vazio"
              description="Escreva ou mande um áudio no WhatsApp do Safralume, do jeito que você fala, e o lançamento aparece aqui. Ou use o botão Novo lançamento."
              action={
                <div className="flex flex-col items-center gap-3">
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {(temPrata
                      ? [...EXEMPLOS, "tenho 5.000 sacas de soja no armazém"]
                      : EXEMPLOS
                    ).map((e) => (
                      <li key={e} className="rounded-full bg-secondary px-3 py-1">
                        “{e}”
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setTipoInicial("gasto");
                        setEditando("novo");
                      }}
                    >
                      <Plus className="size-4" />
                      Novo lançamento
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={buildWhatsAppLink("Gastei 3 mil de diesel hoje")}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <MessageCircle className="size-4" />
                        Abrir o WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1.5">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  periodo === p.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <ResumoCard
              icone={Wallet}
              rotulo="Gastos"
              valor={resumo.gastos}
              nota={`${resumo.nGastos} ${resumo.nGastos === 1 ? "lançamento" : "lançamentos"}`}
              carregando={carregando}
            />
            <ResumoCard
              icone={TrendingUp}
              rotulo="Vendas"
              valor={resumo.vendas}
              nota={`${resumo.nVendas} ${resumo.nVendas === 1 ? "venda" : "vendas"}`}
              carregando={carregando}
            />
            <ResumoCard
              icone={resumo.resultado >= 0 ? TrendingUp : TrendingDown}
              rotulo="Resultado"
              valor={resumo.resultado}
              nota="vendas menos gastos, só do que foi lançado"
              destaque={resumo.resultado >= 0 ? "bom" : "ruim"}
              carregando={carregando}
            />
          </div>

          {erro && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Não consegui carregar o caderno agora. Tente de novo em instantes.
            </p>
          )}

          <PendenciasCard
            pendentes={pendentes}
            onBaixa={darBaixa}
            onEditar={(r) => setEditando(r)}
            onApagar={(r) => setApagando(r)}
          />

          <CustoMargemCard
            produtor={{ id: produtor.id, uf: produtor.uf }}
            culturasSugeridas={culturasSugeridas}
            versao={versao}
          />

          {temPrata ? (
            <EstoqueCard
              produtor={{ id: produtor.id, uf: produtor.uf }}
              versao={versao}
              onInformarEstoque={() => {
                setTipoInicial("estoque");
                setEditando("novo");
              }}
            />
          ) : (
            <EstoqueBloqueado
              assinaturaId={assinaturaId}
              asaasSubscriptionId={asaasSubscriptionId}
            />
          )}

          {!carregando && resumo.porTalhao.length > 0 && (
            <PorTalhaoCard porTalhao={resumo.porTalhao} onFiltrar={(t) => setBusca(t)} />
          )}

          {!carregando && (resumo.porCategoria.length > 0 || porMes.length > 1) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {resumo.porCategoria.length > 0 && (
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <h2 className="font-display text-base font-semibold">
                      Para onde foi o dinheiro
                    </h2>
                    <ul className="space-y-2.5">
                      {resumo.porCategoria.slice(0, 6).map((c) => (
                        <li key={c.categoria}>
                          <div className="mb-1 flex justify-between gap-3 text-sm">
                            <span className="truncate">{c.categoria}</span>
                            <span className="font-mono tabular-nums">{formatarReais(c.total)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-[color:var(--cta)]"
                              style={{ width: `${Math.max(3, (c.total / maiorCategoria) * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {porMes.length > 1 && (
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <h2 className="font-display text-base font-semibold">Mês a mês</h2>
                    <div
                      className="flex h-36 items-end gap-2"
                      role="img"
                      aria-label="Gastos e vendas por mês"
                    >
                      {porMes.slice(-12).map(([mes, v]) => (
                        <div key={mes} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                          <div className="flex h-28 w-full items-end justify-center gap-0.5">
                            <div
                              className="w-1/2 rounded-t bg-[color:var(--cta)]/80"
                              style={{ height: `${Math.max(2, (v.gasto / maiorMes) * 100)}%` }}
                              title={`Gastos: ${formatarReais(v.gasto)}`}
                            />
                            <div
                              className="w-1/2 rounded-t bg-primary"
                              style={{ height: `${Math.max(2, (v.venda / maiorMes) * 100)}%` }}
                              title={`Vendas: ${formatarReais(v.venda)}`}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {mes.slice(5)}/{mes.slice(2, 4)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-[color:var(--cta)]/80" /> Gastos
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-primary" /> Vendas
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {(["todos", ...TIPOS_REGISTRO] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFiltroTipo(t)}
                      aria-pressed={filtroTipo === t}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        filtroTipo === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t === "todos" ? "Todos" : ROTULO_TIPO[t]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar"
                      aria-label="Buscar lançamentos"
                      className="h-8 w-40 pl-8 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={baixarPlanilha}
                    disabled={registros.length === 0}
                  >
                    <Download className="size-4" />
                    Planilha
                  </Button>
                </div>
              </div>

              {carregando ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : grupos.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Nada por aqui nesse período"
                  description="Troque o período ou o filtro, ou faça um novo lançamento."
                />
              ) : (
                <div className="space-y-5">
                  {grupos.map(([dia, itens]) => (
                    <section key={dia}>
                      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {rotuloDoDia(dia)}
                      </h3>
                      <ul className="divide-y rounded-lg border">
                        {itens.map((r) => (
                          <LinhaRegistro
                            key={r.id}
                            r={r}
                            onEditar={() => setEditando(r)}
                            onApagar={() => setApagando(r)}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Só você vê esses dados. O caderno guarda apenas o que você lança; não emite nota fiscal
            nem faz contabilidade. Dúvidas? Fale com o suporte.
          </p>
        </>
      )}

      <FormularioRegistro
        aberto={editando !== null}
        registro={editando === "novo" ? null : editando}
        produtorId={produtor.id}
        produtorWhatsapp={produtor.whatsapp}
        tipoInicial={tipoInicial}
        temPrata={temPrata}
        culturaPadrao={produtor.cultura_principal ?? ""}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          setTemQualquerCoisa(true);
          carregar();
        }}
      />

      <AlertDialog open={apagando !== null} onOpenChange={(o) => !o && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {apagando
                ? `${ROTULO_TIPO[apagando.tipo]} de ${dataLonga(apagando.ocorrido_em)}: ${apagando.descricao}.`
                : ""}{" "}
              Ele some do caderno e dos resumos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apagando && apagar(apagando)}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResumoCard({
  icone: Icone,
  rotulo,
  valor,
  nota,
  destaque,
  carregando,
}: {
  icone: typeof Wallet;
  rotulo: string;
  valor: number;
  nota: string;
  destaque?: "bom" | "ruim";
  carregando: boolean;
}) {
  return (
    <Card className="gap-2 py-3 sm:py-4">
      <CardContent className="space-y-1 px-3 sm:px-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:gap-2 sm:text-sm">
          <Icone className="size-3.5 sm:size-4" />
          {rotulo}
        </p>
        {carregando ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p
            className={`font-mono text-base font-semibold tabular-nums sm:text-2xl ${
              destaque === "ruim" ? "text-destructive" : destaque === "bom" ? "text-primary" : ""
            }`}
          >
            {formatarReais(valor)}
          </p>
        )}
        <p className="hidden text-xs text-muted-foreground sm:block">{nota}</p>
      </CardContent>
    </Card>
  );
}

function LinhaRegistro({
  r,
  onEditar,
  onApagar,
}: {
  r: RegistroFazenda;
  onEditar: () => void;
  onApagar: () => void;
}) {
  const Icone = ICONE_TIPO[r.tipo];
  const qtd =
    r.quantidade !== null && r.unidade ? `${formatarQuantidade(r.quantidade)} ${r.unidade}` : null;
  return (
    <li className="flex items-center gap-3 p-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${COR_TIPO[r.tipo]}`}
      >
        <Icone className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {(r.tipo === "plantio" || r.tipo === "colheita") && r.cultura
            ? `${ROTULO_TIPO[r.tipo]} de ${r.cultura.toLowerCase()}`
            : r.descricao}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {r.tipo !== "gasto" && r.tipo !== "venda" && <span>{ROTULO_TIPO[r.tipo]}</span>}
          {r.categoria && <Badge variant="secondary">{r.categoria}</Badge>}
          {r.cultura && r.tipo !== "plantio" && r.tipo !== "colheita" && <span>{r.cultura}</span>}
          {r.talhao && <span>{r.talhao}</span>}
          {qtd && (
            <span>
              {qtd}
              {r.preco_unitario ? ` a ${formatarReais(r.preco_unitario)}` : ""}
            </span>
          )}
          {r.origem === "funcionario" && (
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              <Users className="size-3" /> Lançado por {r.lancado_por ?? "funcionário"}
            </span>
          )}
          {r.origem === "whatsapp" && (
            <span className="inline-flex items-center gap-0.5">
              <MessageCircle className="size-3" /> WhatsApp
            </span>
          )}
        </div>
      </div>
      {r.valor !== null && (
        <p
          className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
            r.tipo === "venda" ? "text-primary" : ""
          }`}
        >
          {r.tipo === "gasto" ? "− " : r.tipo === "venda" ? "+ " : ""}
          {formatarReais(r.valor)}
        </p>
      )}
      <div className="flex shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 sm:size-8"
          onClick={onEditar}
          aria-label="Editar lançamento"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 sm:size-8"
          onClick={onApagar}
          aria-label="Apagar lançamento"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function FormularioRegistro({
  aberto,
  registro,
  produtorId,
  produtorWhatsapp,
  tipoInicial,
  temPrata,
  culturaPadrao,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  registro: RegistroFazenda | null;
  produtorId: string;
  produtorWhatsapp: string;
  tipoInicial: TipoRegistro;
  temPrata: boolean;
  culturaPadrao: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<TipoRegistro>("gasto");
  const [data, setData] = useState(hojeBrasilia());
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [cultura, setCultura] = useState("");
  const [talhao, setTalhao] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState(false);
  const [venceEm, setVenceEm] = useState("");
  const { session } = useAuth();

  useEffect(() => {
    if (!aberto) return;
    setAviso("");
    if (registro) {
      setTipo(registro.tipo);
      setData(registro.ocorrido_em);
      setDescricao(registro.descricao);
      setValor(registro.valor === null ? "" : String(registro.valor).replace(".", ","));
      setCategoria(registro.categoria ?? "");
      setCultura(registro.cultura ?? "");
      setTalhao(registro.talhao ?? "");
      setQuantidade(
        registro.quantidade === null ? "" : String(registro.quantidade).replace(".", ","),
      );
      setUnidade(registro.unidade ?? "");
      setPendente(registro.situacao === "pendente");
      setVenceEm(registro.vence_em ?? "");
    } else {
      setTipo(tipoInicial);
      setUnidade(tipoInicial === "estoque" ? "sacas" : "");
      setData(hojeBrasilia());
      setDescricao("");
      setValor("");
      setCategoria("");
      setCultura(culturaPadrao);
      setTalhao("");
      setQuantidade("");
      setUnidade("");
      setPendente(false);
      setVenceEm("");
    }
  }, [aberto, registro, culturaPadrao, tipoInicial]);

  const temValor = tipo === "gasto" || tipo === "venda";
  const podePendente = temValor;
  const temQuantidade =
    tipo === "venda" || tipo === "plantio" || tipo === "colheita" || tipo === "estoque";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setAviso("");
    const total = temValor ? (numerosDoTexto(valor)[0] ?? null) : null;
    if (temValor && (total === null || total <= 0)) {
      setAviso("Informe o valor em reais.");
      return;
    }
    const qtd = temQuantidade && quantidade.trim() ? (numerosDoTexto(quantidade)[0] ?? null) : null;
    if (tipo === "estoque" && (qtd === null || qtd <= 0 || !cultura.trim())) {
      setAviso("Informe a cultura e quantas sacas você tem guardadas.");
      return;
    }
    const desc =
      descricao.trim() ||
      (tipo === "plantio" || tipo === "colheita" || tipo === "venda" || tipo === "estoque"
        ? `${ROTULO_TIPO[tipo]}${cultura ? ` de ${cultura.toLowerCase()}` : ""}`
        : "");
    if (!desc) {
      setAviso("Diga do que se trata, por exemplo: adubo, diesel, diária.");
      return;
    }
    const ehPendente = pendente && podePendente;
    if (ehPendente) {
      if (!venceEm || venceEm < hojeBrasilia()) {
        setAviso("Informe a data de vencimento (de hoje em diante).");
        return;
      }
    } else if (data > somarDias(hojeBrasilia(), 1)) {
      setAviso("A data não pode ser no futuro.");
      return;
    }
    const linha = {
      tipo,
      ocorrido_em: ehPendente ? (registro?.ocorrido_em ?? hojeBrasilia()) : data,
      situacao: ehPendente ? "pendente" : "realizado",
      vence_em: ehPendente ? venceEm : null,
      valor: total,
      descricao: desc.slice(0, 200),
      categoria: tipo === "gasto" ? categoria || categoriaDeTexto(desc) : null,
      cultura: cultura.trim() ? cultura.trim().slice(0, 40) : null,
      talhao: talhao.trim() ? talhao.trim().slice(0, 60) : null,
      quantidade: qtd,
      // sem unidade digitada, vale a do placeholder: ha no plantio, sacas nos outros
      unidade:
        qtd !== null
          ? unidade.trim()
            ? unidade.trim().slice(0, 20)
            : tipo === "plantio"
              ? "ha"
              : "sacas"
          : null,
      preco_unitario:
        tipo === "venda" && total && qtd ? Math.round((total / qtd) * 100) / 100 : null,
    };
    setSalvando(true);
    // o lembrete do vencimento acompanha o lançamento: sai o antigo e entra o novo
    if (registro?.lembrete_id) await cancelarLembrete(supabase, registro.lembrete_id);
    const resposta = registro
      ? await supabase
          .from("fazenda_registros")
          .update({ ...linha, lembrete_id: null })
          .eq("id", registro.id)
          .select("id")
          .single()
      : await supabase
          .from("fazenda_registros")
          .insert({ ...linha, produtor_id: produtorId, origem: "painel" })
          .select("id")
          .single();
    const error = resposta.error;
    if (!error && ehPendente && session) {
      const lembreteId = await criarLembreteDoVencimento(
        supabase,
        { id: produtorId, whatsapp: produtorWhatsapp },
        session.user.id,
        {
          tipo: linha.tipo,
          valor: linha.valor,
          descricao: linha.descricao,
          cultura: linha.cultura,
          vence_em: venceEm,
        },
      );
      if (lembreteId) {
        await supabase
          .from("fazenda_registros")
          .update({ lembrete_id: lembreteId })
          .eq("id", (resposta.data as { id: string }).id);
      }
    }
    setSalvando(false);
    if (error) {
      setAviso("Não foi possível salvar agora. Tente de novo em instantes.");
      return;
    }
    toast.success(registro ? "Lançamento atualizado." : "Anotado no caderno.");
    onSalvo();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{registro ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            O que aconteceu na fazenda? Preencha só o que souber.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div
            role="radiogroup"
            aria-label="Tipo"
            className={`grid gap-1.5 ${temPrata || tipo === "estoque" ? "grid-cols-6" : "grid-cols-5"}`}
          >
            {TIPOS_REGISTRO.filter((t) => t !== "estoque" || temPrata || tipo === "estoque").map(
              (t) => {
                const Icone = ICONE_TIPO[t];
                return (
                  <button
                    type="button"
                    key={t}
                    role="radio"
                    aria-checked={tipo === t}
                    onClick={() => setTipo(t)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition-colors ${
                      tipo === t
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icone className="size-4" />
                    {ROTULO_TIPO[t]}
                  </button>
                );
              },
            )}
          </div>

          {podePendente && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-primary)]"
                checked={pendente}
                onChange={(e) => setPendente(e.target.checked)}
                data-testid="fz-pendente"
              />
              <span>
                <span className="font-medium">
                  {tipo === "venda" ? "Ainda não recebi (a receber)" : "Ainda não paguei (a pagar)"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Eu te lembro no dia do vencimento e o valor só entra nas contas quando você der
                  baixa.
                </span>
              </span>
            </label>
          )}

          {temValor && (
            <div className="space-y-1.5">
              <Label htmlFor="fz-valor">Valor total (R$)</Label>
              <Input
                id="fz-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex: 12000 ou 12 mil"
                autoComplete="off"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fz-desc">{tipo === "nota" ? "Anotação" : "Descrição"}</Label>
            <Input
              id="fz-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={
                tipo === "gasto"
                  ? "Ex: adubo NPK, diesel, diária do Jorge"
                  : tipo === "venda"
                    ? "Ex: soja para a cooperativa"
                    : tipo === "nota"
                      ? "Ex: revisar a bomba do poço"
                      : "Opcional"
              }
              maxLength={200}
              autoComplete="off"
            />
          </div>

          {tipo === "gasto" && (
            <div className="space-y-1.5">
              <Label htmlFor="fz-cat">Categoria</Label>
              <Select
                value={categoria || "auto"}
                onValueChange={(v) => setCategoria(v === "auto" ? "" : v)}
              >
                <SelectTrigger id="fz-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Escolher pelo que escrevi</SelectItem>
                  {CATEGORIAS_GASTO.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {temQuantidade && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fz-qtd">Quantidade</Label>
                <Input
                  id="fz-qtd"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder={tipo === "venda" || tipo === "estoque" ? "500" : "50"}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fz-un">Unidade</Label>
                <Input
                  id="fz-un"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  placeholder={
                    tipo === "venda" || tipo === "colheita" || tipo === "estoque" ? "sacas" : "ha"
                  }
                  maxLength={20}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fz-cultura">Cultura</Label>
              <Input
                id="fz-cultura"
                value={cultura}
                onChange={(e) => setCultura(e.target.value)}
                placeholder="Soja, milho, boi..."
                maxLength={40}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fz-talhao">Talhão ou área</Label>
              <Input
                id="fz-talhao"
                value={talhao}
                onChange={(e) => setTalhao(e.target.value)}
                placeholder="Talhão 3"
                maxLength={60}
                autoComplete="off"
              />
            </div>
          </div>

          {pendente && podePendente ? (
            <div className="space-y-1.5">
              <Label htmlFor="fz-vence">Vence em</Label>
              <Input
                id="fz-vence"
                type="date"
                value={venceEm}
                min={hojeBrasilia()}
                onChange={(e) => setVenceEm(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="fz-data">Data</Label>
              <Input
                id="fz-data"
                type="date"
                value={data}
                max={somarDias(hojeBrasilia(), 1)}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
          )}

          {aviso && (
            <p role="alert" className="text-sm text-destructive">
              {aviso}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="size-4 animate-spin" />}
              {registro ? "Salvar" : "Anotar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
