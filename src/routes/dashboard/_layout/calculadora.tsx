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
import { buscarPrecosDaUf, type LinhaEstado, type LinhaRegional } from "@/lib/precos";
import { mediaDePracas } from "@/lib/precoFonte";
import { buscarFrete, type ResultadoFrete } from "@/lib/paridade";

export const Route = createFileRoute("/dashboard/_layout/calculadora")({
  component: CalculadoraConteudo,
});

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  const [serieEstado, setSerieEstado] = useState<LinhaEstado[] | null | undefined>(undefined);
  const [regionais, setRegionais] = useState<LinhaRegional[]>([]);
  const [frete, setFrete] = useState<ResultadoFrete | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase || !cultura || !uf) {
      setSerieEstado(null);
      setRegionais([]);
      setFrete(null);
      return;
    }
    let ativo = true;
    setSerieEstado(undefined);
    setFrete(undefined);
    // Mesma fonte de preço do card "Seu preço hoje": série do estado quando
    // está em dia, ou as praças mais recentes quando não está.
    buscarPrecosDaUf(supabase, cultura, uf).then((r) => {
      if (!ativo) return;
      setSerieEstado(r.serieEstado);
      setRegionais(r.regionais);
    });
    // Mesmo cálculo de frete/paridade do painel: só soja em PR/SP/MS/MG tem
    // paridade de porto de verdade; o resto mostra frete de referência.
    // Usa a coordenada cadastrada só quando a UF escolhida é a mesma do
    // cadastro (senão a coordenada não tem relação com a rota certa).
    const usaCoordenadaDoProdutor = produtor?.uf === uf;
    buscarFrete(supabase, {
      cultura,
      uf,
      lat: usaCoordenadaDoProdutor ? (produtor?.lat ?? null) : null,
      lon: usaCoordenadaDoProdutor ? (produtor?.lon ?? null) : null,
    })
      .then((r) => ativo && setFrete(r))
      .catch(() => ativo && setFrete(null));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cultura, uf]);

  if (!produtor) return null;

  const precoAtual =
    serieEstado?.at(-1)?.preco ??
    (regionais.length > 0 ? mediaDePracas(regionais.map((r) => r.preco)) : null);

  const sacasNum = lerNumero(sacas);
  const custoNum = lerNumero(custoSaca);

  const valorBruto = precoAtual != null && sacasNum != null ? precoAtual * sacasNum : null;
  const custoTotal = custoNum != null && sacasNum != null ? custoNum * sacasNum : null;
  const margemTotal = valorBruto != null && custoTotal != null ? valorBruto - custoTotal : null;
  const margemPorSaca = precoAtual != null && custoNum != null ? precoAtual - custoNum : null;

  const carregando = serieEstado === undefined || frete === undefined;
  const nomeCultura = culturas.find((c) => c.value === cultura)?.label ?? cultura;

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
          ) : precoAtual == null ? (
            <p className="text-sm text-muted-foreground">
              Ainda não temos preço de {nomeCultura.toLowerCase()} em {uf}.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Cotação atual (por saca)</p>
                <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {brl(precoAtual)}
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
                    {sacasNum.toLocaleString("pt-BR")} sacas × {brl(precoAtual)}
                  </p>
                </div>
              )}

              {frete && (
                <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm text-foreground">
                  {frete.frase}
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
                Cálculo com o preço real que sua região tem hoje. O custo de produção é o que você
                informou acima — a Safralume não estima seu custo, só faz a conta com o número que
                você digitar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
