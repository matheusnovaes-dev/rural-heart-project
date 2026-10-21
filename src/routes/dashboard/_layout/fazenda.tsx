import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
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
  Wallet,
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
import { useRequireProdutor } from "@/lib/auth";
import { buildWhatsAppLink } from "@/config/site";
import {
  CATEGORIAS_GASTO,
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

const COLUNAS =
  "id, tipo, ocorrido_em, valor, descricao, categoria, cultura, talhao, quantidade, unidade, preco_unitario, origem, criado_em";

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
};

const COR_TIPO: Record<TipoRegistro, string> = {
  gasto: "bg-amber-100 text-amber-900",
  venda: "bg-emerald-100 text-emerald-900",
  plantio: "bg-lime-100 text-lime-900",
  colheita: "bg-orange-100 text-orange-900",
  nota: "bg-slate-100 text-slate-700",
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

  const carregar = useCallback(async () => {
    if (!supabase || !produtor) return;
    setCarregando(true);
    const { desde, ate } = intervaloDoPeriodo(periodo);
    const { data, error } = await supabase
      .from("fazenda_registros")
      .select(COLUNAS)
      .eq("produtor_id", produtor.id)
      .is("apagado_em", null)
      .gte("ocorrido_em", desde)
      .lte("ocorrido_em", ate)
      .order("ocorrido_em", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(2000);
    setErro(!!error);
    const lista = (data ?? []) as unknown as RegistroFazenda[];
    setRegistros(lista);
    if (lista.length > 0) setTemQualquerCoisa(true);
    else if (periodo === "tudo" || temQualquerCoisa === null) {
      if (periodo === "tudo") setTemQualquerCoisa(false);
      else {
        const { count } = await supabase
          .from("fazenda_registros")
          .select("id", { count: "exact", head: true })
          .eq("produtor_id", produtor.id)
          .is("apagado_em", null);
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
    toast.success("Lançamento apagado.");
    setApagando(null);
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
            <Button size="sm" onClick={() => setEditando("novo")}>
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
                    {EXEMPLOS.map((e) => (
                      <li key={e} className="rounded-full bg-secondary px-3 py-1">
                        “{e}”
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" onClick={() => setEditando("novo")}>
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

          <div className="grid gap-3 sm:grid-cols-3">
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
    <Card className="gap-2 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icone className="size-4" />
          {rotulo}
        </p>
        {carregando ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p
            className={`font-mono text-2xl font-semibold tabular-nums ${
              destaque === "ruim" ? "text-destructive" : destaque === "bom" ? "text-primary" : ""
            }`}
          >
            {formatarReais(valor)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{nota}</p>
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
        <p className="truncate text-sm font-medium">{r.descricao}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{ROTULO_TIPO[r.tipo]}</span>
          {r.categoria && <Badge variant="secondary">{r.categoria}</Badge>}
          {r.cultura && <span>{r.cultura}</span>}
          {r.talhao && <span>{r.talhao}</span>}
          {qtd && (
            <span>
              {qtd}
              {r.preco_unitario ? ` a ${formatarReais(r.preco_unitario)}` : ""}
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
          className="size-8"
          onClick={onEditar}
          aria-label="Editar lançamento"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
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
  culturaPadrao,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  registro: RegistroFazenda | null;
  produtorId: string;
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
    } else {
      setTipo("gasto");
      setData(hojeBrasilia());
      setDescricao("");
      setValor("");
      setCategoria("");
      setCultura(culturaPadrao);
      setTalhao("");
      setQuantidade("");
      setUnidade("");
    }
  }, [aberto, registro, culturaPadrao]);

  const temValor = tipo === "gasto" || tipo === "venda";
  const temQuantidade = tipo === "venda" || tipo === "plantio" || tipo === "colheita";

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
    const desc =
      descricao.trim() ||
      (tipo === "plantio" || tipo === "colheita" || tipo === "venda"
        ? `${ROTULO_TIPO[tipo]}${cultura ? ` de ${cultura.toLowerCase()}` : ""}`
        : "");
    if (!desc) {
      setAviso("Diga do que se trata, por exemplo: adubo, diesel, diária.");
      return;
    }
    if (data > somarDias(hojeBrasilia(), 1)) {
      setAviso("A data não pode ser no futuro.");
      return;
    }
    const linha = {
      tipo,
      ocorrido_em: data,
      valor: total,
      descricao: desc.slice(0, 200),
      categoria: tipo === "gasto" ? categoria || categoriaDeTexto(desc) : null,
      cultura: cultura.trim() ? cultura.trim().slice(0, 40) : null,
      talhao: talhao.trim() ? talhao.trim().slice(0, 60) : null,
      quantidade: qtd,
      unidade: qtd !== null && unidade.trim() ? unidade.trim().slice(0, 20) : null,
      preco_unitario:
        tipo === "venda" && total && qtd ? Math.round((total / qtd) * 100) / 100 : null,
    };
    setSalvando(true);
    const { error } = registro
      ? await supabase.from("fazenda_registros").update(linha).eq("id", registro.id)
      : await supabase
          .from("fazenda_registros")
          .insert({ ...linha, produtor_id: produtorId, origem: "painel" });
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
          <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-5 gap-1.5">
            {TIPOS_REGISTRO.map((t) => {
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
            })}
          </div>

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
                  placeholder={tipo === "venda" ? "500" : "50"}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fz-un">Unidade</Label>
                <Input
                  id="fz-un"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  placeholder={tipo === "venda" || tipo === "colheita" ? "sacas" : "ha"}
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
