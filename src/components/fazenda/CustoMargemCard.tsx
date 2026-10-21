import { Calculator, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizarCultura } from "@/config/culturas";
import { formatarQuantidade, formatarReais, numerosDoTexto } from "@/lib/fazenda.shared";
import { useCustosDaSafra, type Area } from "@/components/fazenda/useCustosDaSafra";
import { supabase } from "@/lib/supabase";

/**
 * Custo por saca e margem: o que o produtor lançou de gasto na safra, dividido pela produção (colhida e lançada, a
 * que ele informou ou a média da Conab do estado), contra o preço de hoje. Estimativa, e o cartão diz isso.
 */
export function CustoMargemCard({
  produtor,
  culturasSugeridas,
  versao,
}: {
  produtor: { id: string; uf: string | null };
  culturasSugeridas: string[];
  /** muda quando o caderno recarrega (novo lançamento), para refazer a conta */
  versao: number;
}) {
  const { contas, carregando, recarregar, rotulo } = useCustosDaSafra(produtor, versao);
  const [editando, setEditando] = useState<Area | "nova" | null>(null);

  async function remover(a: Area) {
    if (!supabase) return;
    const { error } = await supabase.from("fazenda_areas").delete().eq("id", a.id);
    if (error) {
      toast.error("Não foi possível remover a área.");
      return;
    }
    toast.success("Área removida.");
    recarregar();
  }

  return (
    <Card data-testid="custo-margem">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Custo por saca e margem</h2>
            <span className="text-xs text-muted-foreground">{rotulo}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditando("nova")}>
            <Plus className="size-4" />
            Informar área
          </Button>
        </div>

        {carregando ? (
          <Skeleton className="h-24 w-full" />
        ) : contas.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Diga quantos hectares você planta de cada cultura e eu calculo quanto custa cada saca e
            qual a sua margem com o preço de hoje, usando o que você lançou de gasto. Pelo WhatsApp
            também dá: mande “custo por saca”.
          </p>
        ) : (
          <div className="space-y-4">
            {contas.map(({ area: a, soma, conta, mercado: m }) => (
              <div key={a.id} className="rounded-lg border p-4" data-testid={`custo-${a.cultura}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium capitalize">{a.cultura}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatarQuantidade(a.area_ha)} ha
                      {a.produtividade_sc_ha
                        ? ` · ${formatarQuantidade(a.produtividade_sc_ha)} sacas por hectare`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setEditando(a)}
                      aria-label={`Editar área de ${a.cultura}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => remover(a)}
                      aria-label={`Remover área de ${a.cultura}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {conta.gastos <= 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Ainda não há gastos de {a.cultura} lançados nesta safra.
                  </p>
                ) : (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                    <Dado
                      rotulo="Gastos lançados"
                      valor={formatarReais(conta.gastos)}
                      nota={`${formatarReais(conta.custoPorHa)} por ha`}
                    />
                    <Dado
                      rotulo="Produção considerada"
                      valor={conta.sacas ? `${formatarQuantidade(conta.sacas)} sc` : "sem dado"}
                      nota={
                        conta.sacasOrigem === "colhido"
                          ? "colhido e lançado"
                          : conta.sacasOrigem === "informada"
                            ? "a que você informou"
                            : conta.sacasOrigem === "conab"
                              ? `média da Conab${m?.conab ? ` (${formatarQuantidade(m.conab.scHa)} sc/ha)` : ""}`
                              : "informe as sacas por hectare"
                      }
                    />
                    <Dado
                      rotulo="Custo por saca"
                      valor={conta.custoPorSaca !== null ? formatarReais(conta.custoPorSaca) : "?"}
                      destaque
                    />
                    <Dado
                      rotulo="Margem por saca"
                      valor={
                        conta.margemPorSaca !== null
                          ? `${conta.margemPorSaca < 0 ? "− " : ""}${formatarReais(Math.abs(conta.margemPorSaca))}`
                          : m?.preco === null
                            ? "sem preço"
                            : "..."
                      }
                      nota={
                        conta.margemPct !== null
                          ? `${formatarQuantidade(conta.margemPct)}% do preço de ${formatarReais(m!.preco!.preco)}`
                          : undefined
                      }
                      ruim={conta.margemPorSaca !== null && conta.margemPorSaca < 0}
                      bom={conta.margemPorSaca !== null && conta.margemPorSaca >= 0}
                    />
                  </dl>
                )}
                {soma.semCulturaIncluidos > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Inclui {formatarReais(soma.semCulturaIncluidos)} lançados sem cultura, que
                    contei como de {a.cultura} porque é a única com área informada.
                  </p>
                )}
                {soma.semCulturaFora > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatarReais(soma.semCulturaFora)} lançados sem cultura não entraram na conta.
                    Se forem de {a.cultura}, edite o lançamento e informe a cultura.
                  </p>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              É uma estimativa: conta só o que foi lançado no caderno. Arrendamento, juros e o que
              você não anotou ficam de fora, então a margem real tende a ser menor. Preço de hoje:
              dados públicos de mercado (BBM e outras fontes), não é recomendação de venda.
            </p>
          </div>
        )}
      </CardContent>

      <FormularioArea
        aberto={editando !== null}
        area={editando === "nova" ? null : editando}
        produtorId={produtor.id}
        sugestoes={culturasSugeridas}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          recarregar();
        }}
      />
    </Card>
  );
}

function Dado({
  rotulo,
  valor,
  nota,
  destaque,
  bom,
  ruim,
}: {
  rotulo: string;
  valor: string;
  nota?: string | undefined;
  destaque?: boolean;
  bom?: boolean;
  ruim?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd
        className={`font-mono text-base font-semibold tabular-nums ${
          ruim ? "text-destructive" : bom ? "text-primary" : ""
        } ${destaque ? "text-lg" : ""}`}
      >
        {valor}
      </dd>
      {nota && <p className="text-[11px] leading-tight text-muted-foreground">{nota}</p>}
    </div>
  );
}

function FormularioArea({
  aberto,
  area,
  produtorId,
  sugestoes,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  area: Area | null;
  produtorId: string;
  sugestoes: string[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [cultura, setCultura] = useState("");
  const [hectares, setHectares] = useState("");
  const [produtividade, setProdutividade] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setAviso("");
    setCultura(area?.cultura ?? sugestoes[0] ?? "");
    setHectares(area ? String(area.area_ha).replace(".", ",") : "");
    setProdutividade(
      area?.produtividade_sc_ha ? String(area.produtividade_sc_ha).replace(".", ",") : "",
    );
  }, [aberto, area, sugestoes]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const nome = normalizarCultura(cultura.trim());
    const ha = numerosDoTexto(hectares)[0] ?? null;
    const prod = produtividade.trim() ? (numerosDoTexto(produtividade)[0] ?? null) : null;
    if (!nome) return setAviso("Diga a cultura, por exemplo: soja.");
    if (ha === null || ha <= 0 || ha > 5_000_000) return setAviso("Informe os hectares.");
    if (prod !== null && (prod < 1 || prod > 500))
      return setAviso("As sacas por hectare parecem fora do normal. Confira o número.");
    setSalvando(true);
    const { error } = await supabase.from("fazenda_areas").upsert(
      {
        produtor_id: produtorId,
        cultura: nome.slice(0, 40),
        area_ha: ha,
        produtividade_sc_ha: prod,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "produtor_id,cultura" },
    );
    setSalvando(false);
    if (error) return setAviso("Não foi possível salvar agora. Tente de novo em instantes.");
    toast.success("Área salva.");
    onSalvo();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Área da cultura</DialogTitle>
          <DialogDescription>
            Com a área eu calculo o custo por saca. As sacas por hectare são opcionais: sem elas uso
            a média da Conab do seu estado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="ar-cultura">Cultura</Label>
            <Input
              id="ar-cultura"
              list="ar-sugestoes"
              value={cultura}
              onChange={(e) => setCultura(e.target.value)}
              placeholder="Soja, milho, café..."
              maxLength={40}
              autoComplete="off"
              disabled={!!area}
            />
            <datalist id="ar-sugestoes">
              {sugestoes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ar-ha">Hectares</Label>
              <Input
                id="ar-ha"
                inputMode="decimal"
                value={hectares}
                onChange={(e) => setHectares(e.target.value)}
                placeholder="500"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ar-prod">Sacas por ha</Label>
              <Input
                id="ar-prod"
                inputMode="decimal"
                value={produtividade}
                onChange={(e) => setProdutividade(e.target.value)}
                placeholder="opcional"
                autoComplete="off"
              />
            </div>
          </div>
          {aviso && (
            <p role="alert" className="text-sm text-destructive">
              {aviso}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
