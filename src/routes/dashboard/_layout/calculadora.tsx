import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { culturas } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { calcularValorProducao, type ResultadoCalculadora } from "@/lib/calculadora";

export const Route = createFileRoute("/dashboard/_layout/calculadora")({
  component: CalculadoraConteudo,
});

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nomeDaUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;

/** Aceita "5.000" ou "5000" ou "5000,5"; null se não for um número válido. */
function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function CalculadoraConteudo() {
  const { produtor } = useAuth();

  const [cultura, setCultura] = useState(produtor?.cultura_principal ?? "soja");
  const [uf, setUf] = useState(produtor?.uf ?? "");
  const [sacas, setSacas] = useState("");
  const [custoSaca, setCustoSaca] = useState("");
  const [ufReferencia, setUfReferencia] = useState<string | null>(null);
  // Separado de ufReferencia de propósito: clicar em "trocar estado" só
  // mostra a lista de novo, não muda a UF escolhida até o produtor clicar
  // numa opção — senão o clique em "trocar" reseta pra null e cai direto de
  // volta na mesma UF (a escolha automática é sempre a mais recente).
  const [escolhendoUf, setEscolhendoUf] = useState(false);

  // Lembra o que o produtor já digitou (sacas/custo mudam pouco de uma
  // visita pra outra) — só conveniência do navegador, nunca é lido de volta
  // pelo servidor nem por outra pessoa.
  useEffect(() => {
    if (!produtor) return;
    try {
      const salvo = localStorage.getItem(`safralume_calc_${produtor.id}`);
      if (!salvo) return;
      const dados = JSON.parse(salvo) as { sacas?: string; custoSaca?: string };
      if (dados.sacas) setSacas(dados.sacas);
      if (dados.custoSaca) setCustoSaca(dados.custoSaca);
    } catch {
      // localStorage indisponível (navegador privado, etc.) — segue sem lembrar.
    }
  }, [produtor]);
  useEffect(() => {
    if (!produtor) return;
    try {
      localStorage.setItem(`safralume_calc_${produtor.id}`, JSON.stringify({ sacas, custoSaca }));
    } catch {
      // idem acima.
    }
  }, [produtor, sacas, custoSaca]);

  const [resultado, setResultado] = useState<ResultadoCalculadora | null | undefined>(undefined);

  const sacasNum = lerNumero(sacas);
  const custoNum = lerNumero(custoSaca);

  useEffect(() => {
    if (!supabase || !cultura || !uf) {
      setResultado(null);
      return;
    }
    let ativo = true;
    setResultado(undefined);
    const usaCoordenadaDoProdutor = produtor?.uf === uf;
    calcularValorProducao(supabase, {
      cultura,
      uf,
      sacas: sacasNum,
      custoSaca: custoNum,
      lat: usaCoordenadaDoProdutor ? (produtor?.lat ?? null) : null,
      lon: usaCoordenadaDoProdutor ? (produtor?.lon ?? null) : null,
      ufReferencia,
    }).then((r) => ativo && setResultado(r));
    return () => {
      ativo = false;
    };
    // sacasNum/custoNum ficam de fora de propósito: mudar só a quantidade
    // não deveria disparar uma busca nova ao banco, é conta local em cima
    // do preço que já veio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cultura, uf, ufReferencia]);

  // Muda cultura/UF reseta a UF de referência escolhida (senão ficaria presa
  // à escolha de uma combinação anterior).
  useEffect(() => {
    setUfReferencia(null);
    setEscolhendoUf(false);
  }, [cultura, uf]);

  if (!produtor) return null;

  const carregando = resultado === undefined;
  const nomeCultura = culturas.find((c) => c.value === cultura)?.label ?? cultura;

  // Recalcula localmente quando só sacas/custo mudam (sem nova busca), a
  // partir do preço já carregado — evita ida ao banco por cada tecla digitada.
  const precoAtual = resultado?.precoAtual ?? null;
  const valorBruto = precoAtual != null && sacasNum != null ? precoAtual * sacasNum : null;
  const custoTotal = custoNum != null && sacasNum != null ? custoNum * sacasNum : null;
  const margemTotal = valorBruto != null && custoTotal != null ? valorBruto - custoTotal : null;
  const margemPorSaca = precoAtual != null && custoNum != null ? precoAtual - custoNum : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Calculator}
        title="Calculadora de Safra"
        description="Quanto sua produção vale hoje, com preço real da sua região."
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 px-4 pb-3">
          <CardTitle className="text-base">Sua produção</CardTitle>
          <CardDescription>Cultura, estado e quanto você tem pra vender.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cultura</Label>
            <Select value={cultura} onValueChange={setCultura}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {culturas.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado (UF)</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione seu estado" />
              </SelectTrigger>
              <SelectContent>
                {ufs.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-sacas">Quantidade (sacas de 60 kg)</Label>
            <Input
              id="calc-sacas"
              inputMode="decimal"
              placeholder="Ex: 5.000"
              value={sacas}
              onChange={(e) => setSacas(e.target.value)}
              aria-invalid={sacas.trim() !== "" && sacasNum == null}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-custo">Custo de produção (R$ por saca, opcional)</Label>
            <Input
              id="calc-custo"
              inputMode="decimal"
              placeholder="Ex: 110,00"
              value={custoSaca}
              onChange={(e) => setCustoSaca(e.target.value)}
              aria-invalid={custoSaca.trim() !== "" && custoNum == null}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 px-4 pb-3">
          <CardTitle className="text-base capitalize">
            {nomeCultura} {uf ? `· ${uf}` : ""}
          </CardTitle>
          <CardDescription>Valor de mercado e margem estimada, com dado de hoje.</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {!uf ? (
            <p className="text-sm text-muted-foreground">Escolha o estado pra calcular.</p>
          ) : carregando ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !resultado?.disponivel && resultado?.outrasUfsDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não temos preço de {nomeCultura.toLowerCase()} em {uf}, nem em nenhum outro
              estado nos últimos dias.
            </p>
          ) : !resultado?.disponivel || escolhendoUf ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {resultado?.disponivel
                  ? "Escolha o estado pra usar como referência:"
                  : `Ainda não temos preço de ${nomeCultura.toLowerCase()} em ${uf}. Mas tem dado real e recente em outros estados — escolha um pra usar como referência:`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resultado?.outrasUfsDisponiveis.map((o) => (
                  <button
                    key={o.uf}
                    type="button"
                    onClick={() => {
                      setUfReferencia(o.uf);
                      setEscolhendoUf(false);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 ${
                      o.uf === resultado?.ufUsada
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    {nomeDaUf(o.uf)} · {brl(o.preco)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {resultado.usandoOutraUf && (
                <div className="rounded-md border border-gold/40 bg-gold-soft/40 p-3 text-sm text-foreground">
                  {nomeCultura} não tem preço em {uf} ainda. Usando{" "}
                  <strong>{nomeDaUf(resultado.ufUsada ?? "")}</strong> como referência (
                  {resultado.fonteFrase}).{" "}
                  {resultado.outrasUfsDisponiveis.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setEscolhendoUf(true)}
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      Trocar estado de referência
                    </button>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Cotação atual (por saca)</p>
                <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {brl(precoAtual!)}
                </p>
              </div>

              {sacasNum != null && valorBruto != null && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    VALOR DA SUA PRODUÇÃO
                  </p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-primary">
                    {brl(valorBruto)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sacasNum.toLocaleString("pt-BR")} sacas × {brl(precoAtual!)}
                  </p>
                </div>
              )}

              {resultado.frete && (
                <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm text-foreground">
                  {resultado.frete.frase}
                </div>
              )}

              {(custoTotal != null || margemPorSaca != null) && (
                <div className="rounded-lg border border-border p-3.5">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    MARGEM ESTIMADA
                  </p>
                  <div className="flex flex-col gap-1.5 text-sm">
                    {custoTotal != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Custo total</span>
                        <span className="font-mono tabular-nums">{brl(custoTotal)}</span>
                      </div>
                    )}
                    {margemTotal != null && (
                      <div className="flex items-center justify-between font-semibold">
                        <span>Margem total</span>
                        <span
                          className={`font-mono tabular-nums ${margemTotal >= 0 ? "text-primary" : "text-destructive"}`}
                        >
                          {brl(margemTotal)}
                        </span>
                      </div>
                    )}
                    {margemPorSaca != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Margem por saca</span>
                        <span
                          className={`font-mono tabular-nums ${margemPorSaca >= 0 ? "text-primary" : "text-destructive"}`}
                        >
                          {brl(margemPorSaca)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Cálculo com o preço real
                {resultado.usandoOutraUf
                  ? ` de ${nomeDaUf(resultado.ufUsada ?? "")}`
                  : " da sua região"}{" "}
                hoje. O custo de produção é o que você informou acima — a Safralume não estima seu
                custo, só faz a conta com o número que você digitar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
